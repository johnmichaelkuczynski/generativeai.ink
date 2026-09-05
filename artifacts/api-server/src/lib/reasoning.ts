import { chatText, chatJson } from "./ai";
import { gradeAnswer } from "./grading";
import { logger } from "./logger";
import { genSpecFor, type SkillArea, type Phase } from "./diagnosticContent";

// Shape of a persisted diagnostic item row (payload/scoring are jsonb).
export interface DiagnosticItemRow {
  id: number;
  position: number;
  type: string;
  prompt: string;
  payload: unknown;
  scoring: unknown;
}

// One student response (matches ReasoningResponseInput in the OpenAPI spec).
export interface ResponseInput {
  itemId: number;
  selectedIndex?: number | null;
  writtenAnswer?: string | null;
}

export type DiagFormat = "mcq" | "hybrid" | "written";
export type ReasoningMetricLike = ReasoningMetric;
export type Instrument = "subject" | "general";

// How many questions each test length contains, per instrument. Kept short so a
// test never feels long; the same counts apply to both instruments.
export type TestLength = "short" | "medium" | "long";

const LENGTH_COUNTS: Record<Instrument, Record<TestLength, number>> = {
  subject: { short: 4, medium: 8, long: 12 },
  general: { short: 4, medium: 8, long: 12 },
};

export function itemCountFor(
  instrument: Instrument,
  length: TestLength,
): number {
  return LENGTH_COUNTS[instrument][length];
}

export interface ReasoningMetric {
  label: string;
  value: string;
  detail?: string | null;
}

// Per-item grade, persisted in the attempt's score summary so a later review
// shows exactly what was graded without re-running the model.
export interface PerItemGrade {
  isCorrect: boolean | null;
  correctIndex: number | null;
  modelAnswer: string | null;
  rationale: string | null;
}

export interface ScoreSummary {
  instrument: Instrument;
  format: DiagFormat;
  headline: string;
  metrics: ReasoningMetric[];
  // Per-item grade by item id. Persisted so a later review is reconstructable.
  gradesByItem: Record<number, PerItemGrade>;
}

interface ItemScoring {
  correctIndex: number;
  modelAnswer?: string;
  skillArea?: SkillArea;
}
interface ItemPayload {
  options: string[];
}

const SKILL_LABELS: Record<SkillArea, string> = {
  analysis: "Analysis",
  inference: "Inference",
  evaluation: "Evaluation",
  deduction: "Deduction",
  induction: "Induction",
};

function itemScoring(item: DiagnosticItemRow): ItemScoring {
  return item.scoring as ItemScoring;
}
function itemOptions(item: DiagnosticItemRow): string[] {
  return (item.payload as ItemPayload).options ?? [];
}
function referenceAnswer(item: DiagnosticItemRow): string {
  const sc = itemScoring(item);
  if (sc.modelAnswer && sc.modelAnswer.trim().length > 0) return sc.modelAnswer;
  const opts = itemOptions(item);
  return opts[sc.correctIndex] ?? "";
}

// --- Model-judged correct option (mcq/hybrid, general only) ---------------
// Independently determine the genuinely correct option for each item using the
// model's own reasoning rather than trusting the stored answer key. The stored
// key is passed only as a fallible hint. On any failure it falls back to the
// stored key per item.
export async function judgeReasoning(
  items: DiagnosticItemRow[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  for (const it of items) result.set(it.id, itemScoring(it).correctIndex);
  if (items.length === 0) return result;

  try {
    const out = await chatJson<{
      answers: { id: number; correctIndex: number }[];
    }>(
      [
        "You are an expert in critical reasoning, logic, and argument analysis. For each multiple-choice question, determine which single option is GENUINELY correct, reasoning from first principles.",
        "A `hint_index` is provided per question — it is the answer key currently stored in the system, but it MAY BE WRONG. Treat it only as a fallible hint; if your own analysis shows a different option is correct, return that index instead.",
        "Return exactly one 0-based option index per question id.",
        'Output strict JSON {"answers": [{"id": number, "correctIndex": number}]} with one entry for every question id provided.',
      ].join("\n"),
      JSON.stringify({
        questions: items.map((it) => ({
          id: it.id,
          question: it.prompt,
          options: itemOptions(it),
          hint_index: itemScoring(it).correctIndex,
        })),
      }),
    );
    for (const a of out.answers ?? []) {
      const item = items.find((it) => it.id === a.id);
      if (!item) continue;
      const optCount = itemOptions(item).length;
      if (
        typeof a.correctIndex === "number" &&
        a.correctIndex >= 0 &&
        a.correctIndex < optCount
      ) {
        result.set(a.id, a.correctIndex);
      }
    }
  } catch (err) {
    logger.warn({ err }, "judgeCritical failed; falling back to stored keys");
  }
  return result;
}

// --- Grading -------------------------------------------------------------

function buildMetrics(
  instrument: Instrument,
  items: DiagnosticItemRow[],
  grades: Map<number, PerItemGrade>,
): { metrics: ReasoningMetric[]; headline: string } {
  let correct = 0;
  let total = 0;
  const perSkill = new Map<SkillArea, { correct: number; total: number }>();

  for (const item of items) {
    const g = grades.get(item.id);
    if (!g || g.isCorrect === null) continue;
    total += 1;
    if (g.isCorrect) correct += 1;
    const skill = itemScoring(item).skillArea;
    if (skill) {
      const b = perSkill.get(skill) ?? { correct: 0, total: 0 };
      b.total += 1;
      if (g.isCorrect) b.correct += 1;
      perSkill.set(skill, b);
    }
  }

  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const metrics: ReasoningMetric[] = [
    { label: "Overall", value: `${correct} / ${total} (${percent}%)` },
  ];
  if (instrument === "general") {
    for (const skill of Object.keys(SKILL_LABELS) as SkillArea[]) {
      const b = perSkill.get(skill);
      if (!b) continue;
      metrics.push({
        label: SKILL_LABELS[skill],
        value: `${b.correct} / ${b.total}`,
      });
    }
  }
  return {
    metrics,
    headline: `You answered ${correct} of ${total} correctly (${percent}%).`,
  };
}

// Grade every item for the attempt, returning a per-item grade map and a score
// summary. mcq/hybrid correctness is the chosen option matching the (model-
// judged, for general reasoning) correct option; written correctness is AI semantic
// equivalence against the item's model answer. Hybrid keeps the written
// justification for review but scores on the option choice.
export async function gradeAssessment(
  instrument: Instrument,
  format: DiagFormat,
  items: DiagnosticItemRow[],
  responses: ResponseInput[],
): Promise<{ summary: ScoreSummary; grades: Map<number, PerItemGrade> }> {
  const byItem = new Map(responses.map((r) => [r.itemId, r]));
  const grades = new Map<number, PerItemGrade>();

  if (format === "written") {
    // AI-grade each written answer against the model answer (in parallel).
    await Promise.all(
      items.map(async (item) => {
        const resp = byItem.get(item.id);
        const written = (resp?.writtenAnswer ?? "").trim();
        const model = referenceAnswer(item);
        if (!written) {
          grades.set(item.id, {
            isCorrect: false,
            correctIndex: null,
            modelAnswer: model,
            rationale: "No answer was provided.",
          });
          return;
        }
        const { correct, explanation } = await gradeAnswer({
          prompt: item.prompt,
          correctAnswer: model,
          userAnswer: written,
        });
        grades.set(item.id, {
          isCorrect: correct,
          correctIndex: null,
          modelAnswer: model,
          rationale: explanation,
        });
      }),
    );
  } else {
    // mcq / hybrid: correctness from the chosen option.
    const judged =
      instrument === "general"
        ? await judgeReasoning(items)
        : new Map<number, number>();
    for (const item of items) {
      const sc = itemScoring(item);
      const correctIndex = judged.get(item.id) ?? sc.correctIndex;
      const resp = byItem.get(item.id);
      const selectedIndex =
        typeof resp?.selectedIndex === "number" ? resp.selectedIndex : null;
      grades.set(item.id, {
        isCorrect: selectedIndex === null ? null : selectedIndex === correctIndex,
        correctIndex,
        // Hybrid shows the model answer alongside the captured justification.
        modelAnswer: format === "hybrid" ? referenceAnswer(item) : null,
        rationale: null,
      });
    }
  }

  const { metrics, headline } = buildMetrics(instrument, items, grades);
  const summary: ScoreSummary = {
    instrument,
    format,
    headline,
    metrics,
    gradesByItem: Object.fromEntries(grades),
  };
  return { summary, grades };
}

// --- Written feedback (AI with deterministic fallback) --------------------

function deterministicFeedback(
  instrument: Instrument,
  summary: ScoreSummary,
): string {
  const overall = summary.metrics.find((m) => m.label === "Overall");
  if (instrument === "general") {
    const weak = summary.metrics
      .filter((m) => m.label !== "Overall")
      .filter((m) => {
        const [c, t] = m.value.split(" / ").map((n) => parseInt(n, 10));
        return Number.isFinite(c) && Number.isFinite(t) && t > 0 && c / t < 0.5;
      })
      .map((m) => m.label);
    const weakLine =
      weak.length > 0
        ? ` Your strongest opportunity for growth is in ${weak.join(", ")}; revisit how to spot assumptions and what conclusions the evidence actually licenses.`
        : " Your reasoning was solid across the items.";
    return `Thanks for working through this reasoning check.${overall?.value ? ` You scored ${overall.value}.` : ""}${weakLine} Remember that a strong answer follows only from the reasons given — distinguish what is stated, what is assumed, and what is merely plausible.`;
  }
  return `Thanks for working through these Evolutionary Psychology cases.${overall?.value ? ` You scored ${overall.value}.` : ""} Strong answers distinguish a hypothesis from evidence, identify alternatives, and avoid treating group patterns as individual destinies or evolutionary origins as moral justification.`;
}

export async function generateFeedback(
  instrument: Instrument,
  assessmentTitle: string,
  summary: ScoreSummary,
): Promise<string> {
  const metricsText = summary.metrics
    .map((m) => `- ${m.label}: ${m.value}${m.detail ? ` (${m.detail})` : ""}`)
    .join("\n");
  const system =
    instrument === "subject"
      ? "You are an instructor giving warm, specific feedback on a student's Evolutionary Psychology reasoning check. In 2-4 sentences, note overall performance and offer one concrete way to separate evolutionary hypotheses, evidence, and alternatives. Use only the metrics provided; do not invent numbers. Plain prose, no markdown headings."
      : "You are a reasoning instructor giving warm, specific feedback on a student's general-reasoning check. 2-4 sentences. Note overall performance and the skill areas to strengthen, using only the metrics provided. Plain prose, no markdown headings.";
  const user = `Assessment: ${assessmentTitle}\nResult summary: ${summary.headline}\nMetrics:\n${metricsText}`;
  try {
    const text = await chatText(system, user);
    if (text && text.length > 20) return text;
  } catch {
    // fall through to deterministic feedback
  }
  return deterministicFeedback(instrument, summary);
}

// --- Retake variant generation ------------------------------------------
// On a retake we generate a fresh set of items of the SAME KIND as the seeded
// template (same instrument, item count, and answer structure) but with
// different scenarios/questions. If the model is unavailable or returns an
// unusable shape, we fall back to the template items so a retake never blocks.

// Content of an item ready to be inserted (no id / attemptId / position yet).
export interface GeneratedItemContent {
  type: string;
  prompt: string;
  payload: unknown;
  scoring: unknown;
}

function rotateOptions(options: string[]): { options: string[]; correctIndex: number } {
  const n = options.length;
  const off = Math.floor(Math.random() * n);
  const rotated = new Array<string>(n);
  for (let k = 0; k < n; k++) {
    rotated[(k + off) % n] = options[k]!;
  }
  return { options: rotated, correctIndex: off };
}

function templateContent(items: DiagnosticItemRow[]): GeneratedItemContent[] {
  return items.map((it) => ({
    type: it.type,
    prompt: it.prompt,
    payload: it.payload,
    scoring: it.scoring,
  }));
}

async function generateGeneralVariant(
  items: DiagnosticItemRow[],
  count: number,
  phase: Phase,
): Promise<GeneratedItemContent[]> {
  // Build a skill-area list of the requested length by cycling the template's
  // skill areas (falling back to the five canonical reasoning skills).
  const pool = items.map((it) => itemScoring(it).skillArea ?? "analysis");
  const base =
    pool.length > 0
      ? pool
      : ["analysis", "inference", "evaluation", "deduction", "induction"];
  const skills = Array.from({ length: count }, (_, i) => base[i % base.length]!);
  const examplePrompts = items.slice(0, 3).map((it) => it.prompt);
  const spec = genSpecFor("general", phase);
  const system =
    "You are an assessment author writing ORIGINAL general-reasoning multiple-choice questions. " +
    "Each question must measure genuine reasoning (not recall, and NOT mere agreement with authority), have exactly four answer options with one unambiguously best answer, and target the requested skill area. " +
    "List the CORRECT option FIRST, followed by three plausible but wrong distractors. " +
    "Write fresh questions on varied, neutral everyday topics — do NOT reuse the example wording. " +
    `Difficulty: ${spec.level} ` +
    'Respond ONLY as JSON of the form {"items":[{"prompt":"...","options":["correct","wrong","wrong","wrong"],"skillArea":"analysis"}]}.';
  const user =
    `Write ${skills.length} new questions, one per skill area in THIS exact order: ${JSON.stringify(skills)}.\n` +
    `Skill areas mean: analysis (identify assumptions/claims/conclusions), inference (what the evidence supports), evaluation (judge argument quality/sources), deduction (what necessarily follows), induction (strength of generalization/causal/analogy).\n` +
    `For style only (do NOT copy these): ${JSON.stringify(examplePrompts)}.`;
  const out = await chatJson<{
    items?: { prompt?: unknown; options?: unknown; skillArea?: unknown }[];
  }>(system, user);
  const raw = out.items;
  if (!Array.isArray(raw) || raw.length !== skills.length) {
    throw new Error("general variant: wrong item count");
  }
  return raw.map((q, i) => {
    const expectedSkill = skills[i]!;
    const prompt = q.prompt;
    const options = q.options;
    if (typeof prompt !== "string" || prompt.trim().length < 8) {
      throw new Error("general variant: bad prompt");
    }
    if (
      !Array.isArray(options) ||
      options.length !== 4 ||
      !options.every((o) => typeof o === "string" && o.trim().length > 0)
    ) {
      throw new Error("general variant: bad options");
    }
    const correctText = (options[0] as string).trim();
    const { options: rotated, correctIndex } = rotateOptions(options as string[]);
    return {
      type: "mcq" as const,
      prompt: prompt.trim(),
      payload: { options: rotated },
      scoring: {
        correctIndex,
        skillArea: expectedSkill,
        modelAnswer: correctText,
      },
    };
  });
}

async function generateSubjectVariant(
  count: number,
  phase: Phase,
  examplePrompts: string[],
): Promise<GeneratedItemContent[]> {
  const spec = genSpecFor("subject", phase);
  const system =
    "You are an assessment author writing ORIGINAL questions for Nano Evolutionary Psychology. " +
    "Every question must be a brief, realistic behavioral, developmental, or research CASE that rewards reasoning from decisive evidence, never definition recall. Keep it answerable with one or two sentences. " +
    "Each has exactly four answer options with one clearly best, well-supported answer. " +
    "List the CORRECT option FIRST, followed by three plausible but worse distractors (an over-simple single-cause claim, an 'obvious'/sensational answer, or an irrelevant one). " +
    "Also write a one-sentence model answer explaining why the first option is best. " +
    "Distinguish hypotheses from evidence, include plausible alternatives, and avoid deterministic or justificatory claims. Keep the subject matter tasteful and age-appropriate. " +
    `Difficulty: ${spec.level} ` +
    `Stay strictly within this scope: ${spec.topicFocus} ` +
    'Respond ONLY as JSON of the form {"items":[{"prompt":"short case ending in a question","options":["best","worse","worse","worse"],"modelAnswer":"why the first option is best"}]}.';
  const user =
    `Write ${count} new, distinct Evolutionary Psychology case questions within the scope above.\n` +
    `For style only (do NOT copy these): ${JSON.stringify(examplePrompts)}.`;
  const out = await chatJson<{
    items?: { prompt?: unknown; options?: unknown; modelAnswer?: unknown }[];
  }>(system, user);
  const raw = out.items;
  if (!Array.isArray(raw) || raw.length !== count) {
    throw new Error("subject variant: wrong item count");
  }
  return raw.map((q) => {
    const prompt = q.prompt;
    const options = q.options;
    const modelAnswer = q.modelAnswer;
    if (typeof prompt !== "string" || prompt.trim().length < 20) {
      throw new Error("subject variant: bad prompt");
    }
    if (
      !Array.isArray(options) ||
      options.length !== 4 ||
      !options.every((o) => typeof o === "string" && o.trim().length > 0)
    ) {
      throw new Error("subject variant: bad options");
    }
    const correctText = (options[0] as string).trim();
    const model =
      typeof modelAnswer === "string" && modelAnswer.trim().length > 0
        ? modelAnswer.trim()
        : correctText;
    const { options: rotated, correctIndex } = rotateOptions(options as string[]);
    return {
      type: "mcq" as const,
      prompt: prompt.trim(),
      payload: { options: rotated },
      scoring: { correctIndex, modelAnswer: model },
    };
  });
}

export async function generateVariantItems(
  instrument: Instrument,
  phase: Phase,
  templateItems: DiagnosticItemRow[],
  count: number,
): Promise<GeneratedItemContent[]> {
  if (count <= 0) return [];
  try {
    const generated =
      instrument === "general"
        ? await generateGeneralVariant(templateItems, count, phase)
        : await generateSubjectVariant(
            count,
            phase,
            templateItems.slice(0, 3).map((it) => it.prompt),
          );
    if (generated.length === count) return generated;
    logger.warn(
      { instrument, phase, want: count, got: generated.length },
      "Reasoning variant: count mismatch, using template",
    );
  } catch (err) {
    logger.warn(
      { instrument, phase, err: err instanceof Error ? err.message : String(err) },
      "Reasoning variant generation failed, using template items",
    );
  }
  // Fallback: cycle the seeded template items up/down to the requested length.
  return cycleToLength(templateContent(templateItems), count);
}

function cycleToLength(
  items: GeneratedItemContent[],
  count: number,
): GeneratedItemContent[] {
  if (items.length === 0) return [];
  return Array.from({ length: count }, (_, i) => items[i % items.length]!);
}

// --- Review ---------------------------------------------------------------

// A per-question review row: the item, what the student answered, and the
// correct answer. Built after submission so the student can see their work.
export interface ReviewItem {
  itemId: number;
  prompt: string;
  options: string[] | null;
  selectedIndex: number | null;
  correctIndex: number | null;
  isCorrect: boolean | null;
  writtenAnswer: string | null;
  modelAnswer: string | null;
  rationale: string | null;
}

export function buildReview(
  format: DiagFormat,
  items: DiagnosticItemRow[],
  responses: ResponseInput[],
  grades: Map<number, PerItemGrade>,
): ReviewItem[] {
  const byItem = new Map(responses.map((r) => [r.itemId, r]));
  return items.map((item) => {
    const resp = byItem.get(item.id);
    const g = grades.get(item.id);
    const showOptions = format !== "written";
    return {
      itemId: item.id,
      prompt: item.prompt,
      options: showOptions ? itemOptions(item) : null,
      selectedIndex:
        showOptions && typeof resp?.selectedIndex === "number"
          ? resp.selectedIndex
          : null,
      correctIndex: showOptions ? (g?.correctIndex ?? null) : null,
      isCorrect: g?.isCorrect ?? null,
      writtenAnswer: format !== "mcq" ? (resp?.writtenAnswer ?? null) : null,
      modelAnswer: g?.modelAnswer ?? null,
      rationale: g?.rationale ?? null,
    };
  });
}

// Strip the hidden scoring key before sending an item to the client. The
// written format hides the options entirely.
export function publicItem(item: DiagnosticItemRow, format: DiagFormat) {
  return {
    id: item.id,
    position: item.position,
    prompt: item.prompt,
    options: format === "written" ? null : itemOptions(item),
  };
}

// Rebuild the per-item grade map from a persisted score summary (used when
// resuming a submitted attempt for review, without re-grading).
export function gradesFromSummary(
  summary: ScoreSummary | null,
): Map<number, PerItemGrade> {
  const map = new Map<number, PerItemGrade>();
  if (!summary?.gradesByItem) return map;
  for (const [k, v] of Object.entries(summary.gradesByItem)) {
    map.set(Number(k), v);
  }
  return map;
}
