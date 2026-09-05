import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import {
  GenerateLongAnswerDiagnosticResponse,
  GradeLongAnswerDiagnosticBody,
  GradeLongAnswerDiagnosticResponse,
} from "@workspace/api-zod";
import {
  db,
  topicsTable,
  lecturesTable,
  assignmentsTable,
  problemsTable,
  attemptsTable,
  answersTable,
  practiceSessionsTable,
  practiceProblemsTable,
  practiceAttemptsTable,
  diagnosticAttemptsTable,
} from "@workspace/db";
import { chatText, chatJson, FAST_MODEL } from "../lib/ai";
import { detect, gptzeroAiScore } from "../lib/detection";
import { gradeAnswer } from "../lib/grading";

const router: IRouter = Router();

type Step = {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
  error?: string;
};

async function run(name: string, fn: () => Promise<string | void>): Promise<Step> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - t0, detail: detail ?? undefined };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { name, ok: false, ms: Date.now() - t0, error: err };
  }
}

function answerParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function answerHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------- Diagnostic 4: visible long-answer HTTP + persistence proof ----------
router.post(
  "/diagnostics/long-answer/generate",
  async (_req, res): Promise<void> => {
    const [problem] = await db
      .select()
      .from(problemsTable)
      .orderBy(asc(problemsTable.id))
      .limit(1);
    if (!problem) {
      res.status(404).json({ error: "no seeded course problem is available" });
      return;
    }

    let answer = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const generated = await chatText(
        "You are a strong student in Nano Evolutionary Psychology. " +
          "Write a correct, specific answer to the supplied real course problem. " +
          "Use the supplied answer key as the conceptual anchor, then develop cautious reasoning about evidence, alternatives, and implications. " +
          "Return exactly five substantial prose paragraphs, each 60-100 words, separated by one blank line. " +
          "Do not use headings, bullets, numbering, code fences, or any text before or after the five paragraphs.",
        JSON.stringify({
          problem: problem.prompt,
          answerKey: problem.correctAnswer,
        }),
      );
      const paragraphs = answerParagraphs(generated);
      if (
        paragraphs.length === 5 &&
        paragraphs.every((paragraph) => paragraph.length >= 180)
      ) {
        answer = paragraphs.join("\n\n");
        break;
      }
    }

    if (!answer) {
      res.status(502).json({
        error:
          "The generator did not return exactly five substantial paragraphs after two attempts.",
      });
      return;
    }

    res.json(
      GenerateLongAnswerDiagnosticResponse.parse({
        problemId: problem.id,
        prompt: problem.prompt,
        answer,
        characterCount: answer.length,
        paragraphCount: answerParagraphs(answer).length,
        hash: answerHash(answer),
        generatedAt: new Date().toISOString(),
      }),
    );
  },
);

router.post(
  "/diagnostics/long-answer/grade",
  async (req, res): Promise<void> => {
    const parsed = GradeLongAnswerDiagnosticBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [problem] = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.id, parsed.data.problemId));
    if (!problem) {
      res.status(404).json({ error: "course problem not found" });
      return;
    }

    const [temporaryAttempt] = await db
      .insert(attemptsTable)
      .values({
        assignmentId: problem.assignmentId,
        status: "in_progress",
      })
      .returning();
    if (!temporaryAttempt) {
      res.status(500).json({ error: "could not create temporary attempt" });
      return;
    }

    try {
      const [stored] = await db
        .insert(answersTable)
        .values({
          attemptId: temporaryAttempt.id,
          problemId: problem.id,
          answer: parsed.data.answer,
          keystrokeCount: parsed.data.answer.length,
          eraseCount: 0,
          bulkInsertCount: 1,
          longestBulkInsertChars: parsed.data.answer.length,
          rewriteSegments: 0,
          durationMs: 5_000,
        })
        .returning();
      if (!stored) throw new Error("could not persist diagnostic answer");

      const [persisted] = await db
        .select()
        .from(answersTable)
        .where(eq(answersTable.id, stored.id));
      if (!persisted) throw new Error("could not read diagnostic answer back");

      const sentHash = answerHash(parsed.data.answer);
      const persistedHash = answerHash(persisted.answer);
      const exactMatch =
        parsed.data.answer === persisted.answer && sentHash === persistedHash;
      const graded = await gradeAnswer({
        prompt: problem.prompt,
        correctAnswer: problem.correctAnswer,
        userAnswer: persisted.answer,
      });

      await db
        .update(answersTable)
        .set({ correct: graded.correct })
        .where(eq(answersTable.id, persisted.id));

      const deleted = await db
        .delete(attemptsTable)
        .where(eq(attemptsTable.id, temporaryAttempt.id))
        .returning({ id: attemptsTable.id });
      const cleanedUp = deleted.length === 1;

      res.json(
        GradeLongAnswerDiagnosticResponse.parse({
          ok: exactMatch && cleanedUp,
          problemId: problem.id,
          prompt: problem.prompt,
          sentAnswer: parsed.data.answer,
          persistedAnswer: persisted.answer,
          sentCharacterCount: parsed.data.answer.length,
          persistedCharacterCount: persisted.answer.length,
          sentParagraphCount: answerParagraphs(parsed.data.answer).length,
          persistedParagraphCount: answerParagraphs(persisted.answer).length,
          sentHash,
          persistedHash,
          exactMatch,
          gradedCorrect: graded.correct,
          gradingExplanation: graded.explanation,
          cleanedUp,
          gradedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      await db
        .delete(attemptsTable)
        .where(eq(attemptsTable.id, temporaryAttempt.id));
      throw error;
    }
  },
);

// ---------- Diagnostic 1: system checks ----------
router.get("/diagnostics/system", async (_req, res) => {
  const steps: Step[] = [];

  steps.push(
    await run("Environment: DATABASE_URL present", async () => {
      if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
      return "ok";
    }),
  );

  steps.push(
    await run("Database: SELECT 1", async () => {
      const r = await db.execute(sql`select 1 as ok`);
      const ok = (r.rows[0] as { ok?: number } | undefined)?.ok;
      if (Number(ok) !== 1) throw new Error("unexpected result");
      return "round-trip ok";
    }),
  );

  steps.push(
    await run("Database: course content seeded", async () => {
      const t = await db.select().from(topicsTable);
      const l = await db.select().from(lecturesTable);
      const a = await db.select().from(assignmentsTable);
      const p = await db.select().from(problemsTable);
      if (t.length < 4) throw new Error(`only ${t.length} topics`);
      if (l.length < 1) throw new Error("no lectures");
      if (a.length < 1) throw new Error("no assignments");
      if (p.length < 1) throw new Error("no problems");
      return `${t.length} topics · ${l.length} lectures · ${a.length} assignments · ${p.length} problems`;
    }),
  );

  steps.push(
    await run("OpenAI integration: chat completion (fast model)", async () => {
      const txt = await chatText(
        "You answer with a single word only.",
        "Reply with exactly the word PONG.",
        FAST_MODEL,
      );
      if (!txt) throw new Error("empty completion");
      return `responded (${txt.length} chars)`;
    }),
  );

  steps.push(
    await run("OpenAI integration: JSON mode", async () => {
      const out = await chatJson<{ ok: boolean }>(
        "Reply only with strict JSON.",
        'Return exactly {"ok": true}.',
        FAST_MODEL,
      );
      if (!out || out.ok !== true) throw new Error("did not return ok:true");
      return "json round-trip ok";
    }),
  );

  steps.push(
    await run("Detection pipeline: heuristic + scoring", async () => {
      const r = await detect("The quick brown fox jumps over the lazy dog.", {
        keystrokeCount: 40,
        eraseCount: 2,
        bulkInsertCount: 0,
        longestBulkInsertChars: 0,
        rewriteSegments: 0,
        durationMs: 8000,
      });
      if (typeof r.aiScore !== "number") throw new Error("no aiScore");
      return `aiScore=${r.aiScore.toFixed(2)} diachronic=${r.diachronicScore.toFixed(2)}`;
    }),
  );

  steps.push(
    await run("GPTZero: API connectivity", async () => {
      if (!process.env.GPTZERO_API_KEY)
        throw new Error("GPTZERO_API_KEY is not set");
      const score = await gptzeroAiScore(
        "In conclusion, the multifaceted tapestry of evolutionary psychology is paramount to navigating adaptation, mating, kinship, cooperation, emotion, cognition, development, and mismatch.",
      );
      if (score == null)
        throw new Error("GPTZero returned no score (key invalid or API down)");
      return `live API responded · ai=${(score * 100).toFixed(0)}%`;
    }),
  );

  steps.push(
    await run("Grader: equivalence check", async () => {
      const g = await gradeAnswer({
        prompt:
          "At Northstar Support, the assistant invents a refund policy because no policy passage was supplied. Explain what the integration should add and why.",
        correctAnswer:
          "The integration should retrieve the relevant help-center passage and include it as grounded context before generation. It should also validate or refuse unsupported answers so plausible wording is not mistaken for policy evidence.",
        userAnswer:
          "Retrieve the matching refund-policy passage into the prompt, then validate that the answer is supported. The model's fluent output alone does not prove it used company policy.",
      });
      if (!g.correct) throw new Error("equivalent grounded-integration answer was rejected");
      return "semantic equivalence ok";
    }),
  );

  const ok = steps.every((s) => s.ok);
  res.json({ ok, generatedAt: new Date().toISOString(), steps });
});

// ---------- Diagnostic 2: synthetic student ----------
function syntheticTrace(text: string, durationMs = 12_000) {
  return {
    keystrokeCount: Math.max(1, text.length),
    eraseCount: 1,
    bulkInsertCount: 0,
    longestBulkInsertChars: 0,
    rewriteSegments: 0,
    durationMs,
  };
}

router.post("/diagnostics/synthetic-run", async (_req, res) => {
  const steps: Step[] = [];
  res.setTimeout(10 * 60 * 1000);

  // Course discovery
  let topics: { id: number; title: string; weekNumber: number }[] = [];
  let lectures: { id: number; body: string }[] = [];
  let assignments: { id: number; title: string; weekNumber: number; kind: string }[] = [];

  steps.push(
    await run("Load course catalog", async () => {
      const t = await db.select().from(topicsTable).orderBy(asc(topicsTable.position));
      topics = t.map((x) => ({ id: x.id, title: x.title, weekNumber: x.weekNumber }));
      const l = await db.select().from(lecturesTable).orderBy(asc(lecturesTable.id));
      lectures = l.map((x) => ({ id: x.id, body: x.body }));
      const a = await db
        .select()
        .from(assignmentsTable)
        .orderBy(asc(assignmentsTable.weekNumber), asc(assignmentsTable.position));
      assignments = a.map((x) => ({
        id: x.id,
        title: x.title,
        weekNumber: x.weekNumber,
        kind: x.kind,
      }));
      return `${topics.length} topics, ${lectures.length} lectures, ${assignments.length} assignments`;
    }),
  );

  steps.push(
    await run("Read each lecture", async () => {
      let total = 0;
      for (const l of lectures) {
        const [row] = await db
          .select()
          .from(lecturesTable)
          .where(eq(lecturesTable.id, l.id));
        if (!row) throw new Error(`lecture ${l.id} missing`);
        total += (row.body ?? "").length;
      }
      return `read ${lectures.length} lectures (${total} chars total)`;
    }),
  );

  // Walk every assignment: start, answer each problem, submit
  for (const a of assignments) {
    steps.push(
      // eslint-disable-next-line no-loop-func
      await run(
        `Assignment "${a.title}" (week ${a.weekNumber}, ${a.kind})`,
        async () => {
          const problems = await db
            .select()
            .from(problemsTable)
            .where(eq(problemsTable.assignmentId, a.id))
            .orderBy(asc(problemsTable.position));
          if (problems.length === 0) throw new Error("no problems");

          // Start (or resume) attempt
          const [existing] = await db
            .select()
            .from(attemptsTable)
            .where(eq(attemptsTable.assignmentId, a.id));
          let attemptId: number;
          if (existing && existing.status === "in_progress") {
            attemptId = existing.id;
          } else {
            const [created] = await db
              .insert(attemptsTable)
              .values({ assignmentId: a.id, status: "in_progress" })
              .returning();
            if (!created) throw new Error("could not start attempt");
            attemptId = created.id;
          }

          // Save an answer for every problem
          for (const p of problems) {
            const synthetic = p.correctAnswer; // synthetic student "knows" the answer
            const trace = syntheticTrace(synthetic);
            await db
              .insert(answersTable)
              .values({
                attemptId,
                problemId: p.id,
                answer: synthetic,
                keystrokeCount: trace.keystrokeCount,
                eraseCount: trace.eraseCount,
                bulkInsertCount: trace.bulkInsertCount,
                longestBulkInsertChars: trace.longestBulkInsertChars,
                rewriteSegments: trace.rewriteSegments,
                durationMs: trace.durationMs,
              })
              .onConflictDoNothing();
          }

          // Grade + AI/diachronic detection on every answer
          const answers = await db
            .select()
            .from(answersTable)
            .where(eq(answersTable.attemptId, attemptId));
          const byProblem = new Map(answers.map((x) => [x.problemId, x]));
          let score = 0;
          for (const p of problems) {
            const ans = byProblem.get(p.id);
            const ua = ans?.answer ?? "";
            const graded = await gradeAnswer({
              prompt: p.prompt,
              correctAnswer: p.correctAnswer,
              userAnswer: ua,
            });
            if (graded.correct) score += 1;
            if (ans && ua.trim().length > 0) {
              const det = await detect(ua, {
                keystrokeCount: ans.keystrokeCount,
                eraseCount: ans.eraseCount,
                bulkInsertCount: ans.bulkInsertCount,
                longestBulkInsertChars: ans.longestBulkInsertChars,
                rewriteSegments: ans.rewriteSegments,
                durationMs: ans.durationMs,
              });
              await db
                .update(answersTable)
                .set({
                  correct: graded.correct,
                  aiScore: det.aiScore,
                  aiFlagged: det.aiFlagged,
                  diachronicScore: det.diachronicScore,
                  diachronicFlagged: det.diachronicFlagged,
                  detectionRationale: det.rationale,
                })
                .where(eq(answersTable.id, ans.id));
            }
          }
          const pct = (score / problems.length) * 100;
          await db
            .update(attemptsTable)
            .set({
              status: "submitted",
              submittedAt: new Date(),
              scorePercent: pct,
            })
            .where(eq(attemptsTable.id, attemptId));
          return `submitted ${problems.length} answers · score ${pct.toFixed(0)}%`;
        },
      ),
    );
  }

  // Practice loop (adaptive + tutor)
  let sessionId: number | null = null;
  steps.push(
    await run("Start practice session (tutor on, focus on weaknesses)", async () => {
      const [s] = await db
        .insert(practiceSessionsTable)
        .values({
          weekNumber: null,
          topicId: null,
          tutorEnabled: true,
          focusOnWeaknesses: true,
          difficulty: 2.0,
        })
        .returning();
      if (!s) throw new Error("could not create session");
      sessionId = s.id;
      return `session #${s.id}`;
    }),
  );

  for (let i = 0; i < 2; i++) {
    steps.push(
      // eslint-disable-next-line no-loop-func
      await run(`Practice problem ${i + 1}: generate + grade + adapt`, async () => {
        if (!sessionId) throw new Error("no session");
        const topic = topics[Math.floor(Math.random() * topics.length)]!;
        const gen = await chatJson<{
          prompt: string;
          correctAnswer: string;
          explanation: string;
        }>(
          `You generate a single Nano Evolutionary Psychology practice problem on "${topic.title}" at easy difficulty. Use a specific named behavioral or research scenario and require a reasoned 1-3 sentence answer that evaluates evidence and alternatives. Never ask for definitions or terminology recall. Avoid deterministic or justificatory claims. Respond as strict JSON: {"prompt": string, "correctAnswer": string, "explanation": string}.`,
          `New problem on ${topic.title}.`,
        );
        const [stored] = await db
          .insert(practiceProblemsTable)
          .values({
            sessionId,
            topicId: topic.id,
            prompt: gen.prompt,
            correctAnswer: gen.correctAnswer,
            explanation: gen.explanation,
            difficulty: 2.0,
          })
          .returning();
        if (!stored) throw new Error("could not store problem");
        const graded = await gradeAnswer({
          prompt: stored.prompt,
          correctAnswer: stored.correctAnswer,
          userAnswer: stored.correctAnswer,
        });
        await db.insert(practiceAttemptsTable).values({
          sessionId,
          problemId: stored.id,
          topicId: stored.topicId,
          answer: stored.correctAnswer,
          correct: graded.correct,
          difficulty: stored.difficulty,
          trace: syntheticTrace(stored.correctAnswer),
        });
        return `topic=${topic.title} · correct=${graded.correct}`;
      }),
    );
  }

  steps.push(
    await run("AI tutor: ask with lecture context", async () => {
      const ctx = (lectures[0]?.body ?? "").slice(0, 400);
      const txt = await chatText(
        "You are a concise tutor. Reply in 2 sentences.",
        `Context from a lecture:\n"""${ctx}"""\n\nStudent question: Northstar Support's chat demo works, but its production service has no conversation state, retries, or schema validation. Which detail from this lecture should Maya address first, and why?`,
      );
      if (!txt) throw new Error("tutor returned nothing");
      return `${txt.length} chars`;
    }),
  );

  steps.push(
    await run("AI detection scan (pasted-style text should flag)", async () => {
      const r = await detect(
        "In conclusion, the multifaceted tapestry of evolutionary psychology is paramount to navigating adaptation, mating, kinship, cooperation, emotion, cognition, development, and mismatch.",
        {
          keystrokeCount: 8,
          eraseCount: 0,
          bulkInsertCount: 1,
          longestBulkInsertChars: 160,
          rewriteSegments: 0,
          durationMs: 1200,
        },
      );
      return `aiScore=${r.aiScore.toFixed(2)} (flagged=${r.aiFlagged}) · diachronic=${r.diachronicScore.toFixed(
        2,
      )} (flagged=${r.diachronicFlagged})`;
    }),
  );

  steps.push(
    await run("Analytics: summary + topics + activity", async () => {
      const submitted = await db
        .select()
        .from(attemptsTable)
        .where(eq(attemptsTable.status, "submitted"));
      const practice = await db.select().from(practiceAttemptsTable);
      const t = await db.select().from(topicsTable);
      return `${submitted.length} submitted attempts · ${practice.length} practice attempts · ${t.length} topics`;
    }),
  );

  steps.push(
    await run("Analytics report (LLM narrative)", async () => {
      const out = await chatJson<{ narrative: string; recommendations: string[] }>(
        "You are an academic advisor. Reply as strict JSON.",
        'Return {"narrative": "ok", "recommendations": ["a","b","c"]}.',
      );
      if (!out.narrative) throw new Error("no narrative");
      return `narrative ${out.narrative.length} chars · ${out.recommendations.length} recs`;
    }),
  );

  const ok = steps.every((s) => s.ok);
  res.json({ ok, generatedAt: new Date().toISOString(), steps });
});

// ---------- Diagnostic 3: OpenAI answer-legitimacy quality control ----------
// Independently re-derives the answer to each course problem with the LLM and
// checks that the seeded model answer is actually a legitimate, correct answer
// to its prompt. Catches bad/ambiguous keys before a student is ever graded
// against them.
router.post("/diagnostics/quality-control", async (_req, res) => {
  const steps: Step[] = [];
  res.setTimeout(10 * 60 * 1000);

  // Build a sample of problems spread across every assignment/unit.
  let sample: {
    id: number;
    prompt: string;
    correctAnswer: string;
    assignmentTitle: string;
    weekNumber: number;
    kind: string;
    lectureBody: string;
  }[] = [];

  // For cumulative assessments (test/midterm/final), the answer key legitimately
  // draws on examples from across the whole unit, not just the single topic the
  // problem is tagged to. Grounding such a key in only its own topic's lecture
  // false-flags correct keys that cite content taught in a sibling topic. We
  // therefore build a per-unit combined lecture text and use it for cumulative
  // problems, while keeping homework scoped to its own topic's lecture.
  const unitLectures = new Map<number, string>();
  const CUMULATIVE_KINDS = new Set(["test", "midterm", "final"]);

  steps.push(
    await run("Collect course problems for review", async () => {
      const rows = await db
        .select({
          id: problemsTable.id,
          prompt: problemsTable.prompt,
          correctAnswer: problemsTable.correctAnswer,
          assignmentTitle: assignmentsTable.title,
          weekNumber: assignmentsTable.weekNumber,
          kind: assignmentsTable.kind,
          lectureBody: lecturesTable.body,
        })
        .from(problemsTable)
        .innerJoin(
          assignmentsTable,
          eq(problemsTable.assignmentId, assignmentsTable.id),
        )
        .innerJoin(lecturesTable, eq(lecturesTable.topicId, problemsTable.topicId))
        .orderBy(asc(assignmentsTable.weekNumber), asc(problemsTable.position));
      if (rows.length === 0) throw new Error("no problems to review");

      // Sample up to MAX_REVIEW problems with guaranteed per-unit coverage:
      // group by unit, give each unit an equal quota, then evenly stride within
      // the unit. This keeps the check fast but never skips a unit even if the
      // problem distribution across units is uneven.
      const MAX_REVIEW = 12;
      if (rows.length <= MAX_REVIEW) {
        sample = rows;
      } else {
        const byUnit = new Map<number, typeof rows>();
        for (const r of rows) {
          const list = byUnit.get(r.weekNumber) ?? [];
          list.push(r);
          byUnit.set(r.weekNumber, list);
        }
        const units = [...byUnit.keys()].sort((a, b) => a - b);
        const base = Math.floor(MAX_REVIEW / units.length);
        let remainder = MAX_REVIEW % units.length;
        const picked: typeof rows = [];
        for (const u of units) {
          const list = byUnit.get(u)!;
          const quota = Math.min(list.length, base + (remainder > 0 ? 1 : 0));
          if (remainder > 0) remainder -= 1;
          const stride = list.length / quota;
          for (let i = 0; i < quota; i++) {
            picked.push(list[Math.floor(i * stride)]!);
          }
        }
        sample = picked;
      }

      // Build the per-unit combined lecture text used to ground cumulative
      // assessment keys. Each topic's lecture is truncated and concatenated
      // (with its title) so a Final/test key can be judged against everything
      // the unit actually taught, not just one topic.
      const allLectures = await db
        .select({
          weekNumber: lecturesTable.weekNumber,
          title: lecturesTable.title,
          body: lecturesTable.body,
        })
        .from(lecturesTable)
        .innerJoin(topicsTable, eq(topicsTable.id, lecturesTable.topicId))
        .orderBy(asc(lecturesTable.weekNumber), asc(topicsTable.position));
      const PER_LECTURE_CAP = 2200;
      const byUnitText = new Map<number, string[]>();
      for (const l of allLectures) {
        const list = byUnitText.get(l.weekNumber) ?? [];
        list.push(`### ${l.title}\n${l.body.slice(0, PER_LECTURE_CAP)}`);
        byUnitText.set(l.weekNumber, list);
      }
      // Cap the combined per-unit text so token cost stays bounded if the
      // curriculum grows to many topics per unit.
      const UNIT_TEXT_CAP = 12000;
      for (const [week, parts] of byUnitText) {
        unitLectures.set(week, parts.join("\n\n").slice(0, UNIT_TEXT_CAP));
      }

      return `reviewing ${sample.length} of ${rows.length} problems`;
    }),
  );

  let legitimate = 0;
  let suspect = 0;
  for (const p of sample) {
    steps.push(
      // eslint-disable-next-line no-loop-func
      await run(
        `${p.assignmentTitle} (day ${p.weekNumber}, ${p.kind}): "${p.prompt.slice(0, 80)}${
          p.prompt.length > 80 ? "…" : ""
        }"`,
        async () => {
          // The course is grounded in a specific source text, whose framework and
          // terminology can differ from mainstream treatments. The check judges
          // keys against what the course actually teaches — not generic textbook
            // evolutionary psychology. Homework is scoped to its own topic's lecture, but
          // cumulative assessments (test/midterm/final) draw on examples from
          // across the whole unit, so they are grounded in every lecture in the
          // unit; otherwise a correct key citing a sibling topic's example
          // (e.g. one lecture's case study reused on the final) is false-flagged
          // as "not in this lecture".
          const isCumulative = CUMULATIVE_KINDS.has(p.kind);
          const lecture = isCumulative
            ? (unitLectures.get(p.weekNumber) ?? p.lectureBody.slice(0, 3500))
            : p.lectureBody.slice(0, 3500);
          const sourceLabel = isCumulative
            ? "the course lectures for this unit"
            : "the course lecture";

          // Phase 1 — independently re-derive the answer from the prompt + the
          // course's own lecture material, blind to the seeded key, so the
          // verdict can't just rubber-stamp the key.
          const derived = await chatText(
            "You are a strong Evolutionary Psychology student answering a scenario-based problem. " +
              `Base your answer on ${sourceLabel} provided, using its framework and terminology rather than outside theories. ` +
              "Answer directly with concise reasoning tied to the scenario, preserving cautious scientific framing. " +
              "Do not restate the prompt or add commentary.\n\n=== COURSE LECTURE MATERIAL ===\n" +
              lecture,
            p.prompt,
          );

          // Phase 2 — judge whether the seeded key is a legitimate answer, given
          // the course lecture material, the prompt, and our independent answer,
          // using the grader's semantic-equivalence philosophy.
          const verdict = await chatJson<{
            legitimate: boolean;
            confidence: number;
            rationale: string;
          }>(
            "You are an academic quality-control reviewer for Nano Evolutionary Psychology. " +
              `You are given ${sourceLabel} the problem is drawn from, a problem prompt, the SHORT answer key the course grades students against, and an independently derived answer produced without seeing the key. ` +
              "Judge the key ONLY against what the provided course material teaches — its definitions, framework, terminology, and examples — not against outside or mainstream treatments that the course does not use. " +
              "When the provided material contains multiple lectures, an example or term taught in ANY of them counts as taught by the course; do not flag a key merely because the example appears in a different lecture than the one most associated with the prompt. " +
              "Answers are graded by semantic equivalence: a key is legitimate if it is a correct, on-topic answer that a fair grader would accept given the course material — it does NOT have to be the only possible answer, the most general phrasing, exhaustive, or identical to the independent answer. " +
              "Use the independent answer only as a cross-check; the key and the independent answer can both be correct while differing in wording or emphasis. Watch for polarity on yes/no and negated prompts. " +
              "Mark a key NOT legitimate ONLY when it is genuinely defective relative to the course material: factually wrong by the course's own account, off-topic, self-contradictory, or so ambiguous it could not be graded fairly. " +
              "Do not penalize a key merely for being brief, for being one of several acceptable answers, for omitting nuance the short format can't carry, or for using the course's terminology instead of mainstream terms. " +
              'Respond as strict JSON: {"legitimate": boolean, "confidence": number between 0 and 1, "rationale": string (1-2 sentences)}.',
            JSON.stringify({
              course_lecture_material: lecture,
              prompt: p.prompt,
              answer_key: p.correctAnswer,
              independently_derived_answer: derived.trim(),
            }),
          );

          // Harden parsing: any malformed verdict is a diagnostic failure, not a
          // pass — we can't trust a QC result we couldn't validate.
          if (typeof verdict.legitimate !== "boolean")
            throw new Error("grader returned no boolean verdict");
          if (
            typeof verdict.confidence !== "number" ||
            !Number.isFinite(verdict.confidence) ||
            verdict.confidence < 0 ||
            verdict.confidence > 1
          )
            throw new Error(
              `grader returned invalid confidence: ${String(verdict.confidence)}`,
            );
          if (
            typeof verdict.rationale !== "string" ||
            !verdict.rationale.trim()
          )
            throw new Error("grader returned no rationale");
          const rationale = verdict.rationale.trim();
          const conf = Math.round(verdict.confidence * 100);
          if (verdict.legitimate) {
            legitimate += 1;
            return `legitimate (confidence ${conf}%) — ${rationale}`;
          }
          suspect += 1;
          throw new Error(
            `flagged as not legitimate (confidence ${conf}%) — ${rationale}`,
          );
        },
      ),
    );
  }

  steps.push(
    await run("Quality-control summary", async () => {
      return `${legitimate} legitimate · ${suspect} flagged out of ${sample.length} reviewed`;
    }),
  );

  const ok = steps.every((s) => s.ok);
  res.json({ ok, generatedAt: new Date().toISOString(), steps });
});

// ---------- Expand lectures: generate medium / long versions with more examples ----------
router.post("/diagnostics/expand-lectures", async (req, res) => {
  const rawLevel = String(req.query.level ?? "");
  if (rawLevel !== "medium" && rawLevel !== "long") {
    res.status(400).json({ error: "level must be 'medium' or 'long'" });
    return;
  }
  const level: "medium" | "long" = rawLevel;

  const rawId = req.query.id;
  let onlyId: number | null = null;
  if (rawId !== undefined && rawId !== "") {
    const parsed = Number(rawId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      res.status(400).json({ error: "id must be a positive integer" });
      return;
    }
    onlyId = parsed;
  }

  const all = await db
    .select({
      id: lecturesTable.id,
      title: lecturesTable.title,
      body: lecturesTable.body,
      bodyMedium: lecturesTable.bodyMedium,
      bodyLong: lecturesTable.bodyLong,
    })
    .from(lecturesTable)
    .orderBy(asc(lecturesTable.id));
  const lectures = onlyId !== null ? all.filter((l) => l.id === onlyId) : all;
  if (onlyId !== null && lectures.length === 0) {
    res.status(404).json({ error: `no lecture with id ${onlyId}` });
    return;
  }

  const ratio = level === "long" ? "roughly 2x to 3x the length of the SHORT version" : "roughly 1.5x to 2x the length of the SHORT version";
  const moreExamples =
    level === "long"
      ? "At least TWO additional worked-through integration cases for every concept beyond what the short version has — pick contrasting deployments, edge cases, and common failure modes."
      : "At least ONE additional fully worked example for every concept beyond what the short version has.";
  const moreExplanation =
    level === "long"
      ? "Considerably more explanation: motivate every design choice, explain WHY it works, name common pitfalls, and add brief validation checks after each worked case."
      : "Noticeably more explanation: clarify each concept, motivate each design choice, and add a short 'why this works' note where useful.";

  const sys =
    `You are an Evolutionary Psychology lecturer producing the ${level.toUpperCase()} version of a lecture. ` +
    "You are given the SHORT version of the lecture. Rewrite it as a longer teaching version. RULES, no exceptions:\n" +
    "1. KEEP every heading and every concept from the SHORT version, in the same order, with the same names. You may add new sub-sections only when needed to introduce additional examples — but no new top-level topics.\n" +
    `2. ${moreExplanation}\n` +
    `3. ${moreExamples} Use \`## Example\` / \`### Example 1\`, \`### Example 2\` headings, with clear thought experiments and worked-through cases.\n` +
    `4. Length target: ${ratio}.\n` +
    "5. Friendly, plain English. Preserve scientifically necessary caution: distinguish hypotheses and evidence and avoid deterministic or justificatory claims. No filler or 'in conclusion'.\n" +
    "6. Return ONLY the rewritten Markdown lecture body. No preface, no commentary, no code fences around the whole thing.";

  let updated = 0;
  let failed = 0;
  const concurrency = 3;
  for (let i = 0; i < lectures.length; i += concurrency) {
    const batch = lectures.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (l) => {
        try {
          const user = `LECTURE TITLE: ${l.title}\n\nSHORT VERSION:\n"""\n${l.body}\n"""`;
          const expanded = await chatText(sys, user);
          if (!expanded || expanded.trim().length < l.body.length * 0.85) {
            failed++;
            return;
          }
          const patch =
            level === "long"
              ? { bodyLong: expanded.trim() }
              : { bodyMedium: expanded.trim() };
          await db.update(lecturesTable).set(patch).where(eq(lecturesTable.id, l.id));
          updated++;
        } catch {
          failed++;
        }
      }),
    );
  }

  res.json({ ok: failed === 0, level, updated, failed, total: lectures.length });
});

// ---------- Reset: wipe all student progress, keep course content ----------
router.post("/diagnostics/reset", async (_req, res) => {
  // Delete in dependency order. Course content (topics, lectures, assignments,
  // problems) is preserved; only student progress / generated practice is wiped.
  await db.delete(practiceAttemptsTable);
  await db.delete(practiceProblemsTable);
  await db.delete(practiceSessionsTable);
  await db.delete(answersTable);
  await db.delete(attemptsTable);
  // Diagnostic attempts are student progress; seeded assessments/items are kept.
  await db.delete(diagnosticAttemptsTable);
  res.json({ ok: true, resetAt: new Date().toISOString() });
});

export default router;
