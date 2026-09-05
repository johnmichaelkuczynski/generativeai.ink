import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLecture,
  useGetWeek,
  useRewriteLecture,
  useClearLectureRewrite,
  useGenerateLectureExamples,
  useAskTutor,
  useStartPracticeSession,
  useNextPracticeProblem,
  useGradePracticeAnswer,
  type PracticeProblem,
  type PracticeGrade,
  type KeystrokeTrace,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { AnswerInput } from "@/components/AnswerInput";
import { MathKeyboard, insertAtTextareaCursor } from "@/components/MathKeyboard";
import { StarterQuestionCard } from "@/components/StarterQuestionCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, MessageSquare, Sparkles, Send, X, RefreshCw, CheckCircle2, XCircle, Wand2, RotateCcw } from "lucide-react";

type ChatMsg = { role: "user" | "tutor"; text: string };

const HIGHLIGHTS_BY_SECTION: Record<string, string[]> = {
  "1. Foundations": [
    "Evolutionary hypotheses explain how selection shaped mechanisms that detect recurring cues and regulate behavior toward reproductive tradeoffs.",
    "An evolutionary mechanism links a recurrent adaptive problem to the cues it detects, the decision rule it uses, and the fitness tradeoff it regulates.",
    "The environment of evolutionary adaptedness describes recurring selection pressures, while gene–culture coevolution describes feedback between inherited capacities and cultural practices.",
  ],
  "2. Mate selection and sexual strategies": [
    "Sexual selection includes both competition for mating opportunities and preferences exercised in mate choice.",
    "Parental investment can shift average patterns of competition and choosiness, but ecology, institutions, sex ratios, and individual circumstances can substantially alter those patterns.",
    "Short- and long-term strategies are conditional tradeoffs rather than fixed categories, and population averages do not determine any individual.",
  ],
  "3. Kinship and altruism": [
    "Inclusive-fitness reasoning predicts when helping relatives can spread by comparing relatedness-weighted benefits with the helper's cost.",
    "Reciprocal altruism can support cooperation among non-relatives when future interaction, memory, partner choice, and responses to cheating make cooperation worthwhile.",
    "Parent–offspring conflict predicts some disagreement over investment without implying that family relationships are generally hostile or reducible to genes.",
  ],
  "4. Social cognition and cooperation": [
    "Theory of mind helps people reason about beliefs and intentions, but its development also depends on language, executive capacity, and social experience.",
    "Strong evidence for specialized cheater detection must outperform explanations based on familiarity, pragmatics, and general reasoning under matched conditions.",
    "Coalitional thinking can produce rapid group distinctions, yet the identities and boundaries involved remain flexible and culturally shaped.",
  ],
  "5. Emotion and motivation": [
    "Emotions coordinate attention, physiology, memory, and action around recurring problems; they are response systems rather than infallible instructions.",
    "Fear, anger, disgust, jealousy, and status motives may prioritize different threats or opportunities, but context and learning shape how they are expressed.",
    "Error-management theory predicts that emotional thresholds shift toward the less costly mistake, such as fear systems accepting false alarms when missed threats are costlier.",
  ],
  "6. Cognitive adaptations": [
    "Domain-specific accounts propose mechanisms tuned to recurring information patterns, whereas domain-general accounts emphasize flexible learning, memory, and executive control.",
    "Specialized systems process recurring information structures, while working memory and executive control coordinate behavior across domains.",
    "Useful evidence compares rival predictions and identifies the information-processing design, rather than relying only on a brain location or a plausible ancestral story.",
  ],
  "7. Evolutionary developmental psychology": [
    "Selection shapes developmental systems that respond to environmental information rather than producing behavior independently of experience.",
    "Life-history approaches examine conditional allocation among growth, maintenance, mating, and parenting under different constraints and cues.",
    "Developmental plasticity can be adaptive without making every outcome optimal, irreversible, or caused by a single childhood signal.",
  ],
  "8. Pathology and mismatch": [
    "Mismatch occurs when a mechanism encounters conditions that differ from those under which its design was shaped.",
    "A vulnerability may reflect defense, tradeoff, by-product, developmental disruption, or mismatch; calling a disorder an adaptation requires separate evidence.",
    "Evolutionary explanations complement clinical causes and treatments, but they do not prove that a modern environment is the sole cause or that suffering is beneficial.",
  ],
  "It tests application, not memorization": [
    "Success requires applying evolutionary concepts to a concrete case rather than reciting definitions.",
    "A strong answer identifies the operative mechanism, uses the scenario's decisive cue, and derives the predicted behavioral tradeoff.",
  ],
  "What the questions reward": [
    "Rewarded answers separate ultimate explanations from proximate mechanisms and developmental causes.",
    "They use course mechanisms to predict when mating, cooperation, threat, status, parenting, and life-history strategies should shift.",
  ],
  "How to do this activity well": [
    "Read for the decision the scenario requires, then answer that decision directly.",
    "Use the named concept only when it changes the reasoning, and include the strongest relevant limitation or competing explanation.",
  ],
  "The five skills": [
    "Identify the evolutionary claim precisely instead of accepting a broad story.",
    "Connect the proposed mechanism to observable predictions and discriminating evidence.",
    "Track how ecological inputs change the expected payoff of mating effort, parental investment, cooperation, status seeking, and future-oriented effort.",
  ],
  "A recurring trap: things that move together": [
    "Use the course's mechanism maps to connect recurrent problems, information cues, decision rules, and predicted outcomes.",
    "A strong analysis looks for confounds, reverse causation, measurement problems, and predictions that separate competing explanations.",
  ],
};

function buildHighlightsMarkdown(body: string): string {
  const headings = body
    .split("\n")
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, "").trim());

  const sections = headings
    .map((heading) => {
      const points = HIGHLIGHTS_BY_SECTION[heading];
      if (!points?.length) return "";
      const plainHeading = heading.replace(/^\d+\.\s*/, "");
      return `## ${plainHeading}\n\n${points.map((point) => `- ${point}`).join("\n")}`;
    })
    .filter(Boolean);

  return `# Highlights\n\n${sections.join("\n\n")}`;
}

export default function LectureView() {
  const params = useParams();
  const lectureId = Number(params.lectureId);
  const { data: lecture, isLoading } = useGetLecture(lectureId);
  const { data: week } = useGetWeek(lecture?.weekNumber ?? 1);

  // Adjacent lectures within the day, so the reader can move straight to the
  // next/previous lecture without going back to the dashboard.
  const { prevLecture, nextLecture } = useMemo(() => {
    const list = week?.lectures ?? [];
    const idx = list.findIndex((l) => l.id === lectureId);
    if (idx === -1) return { prevLecture: null, nextLecture: null };
    return {
      prevLecture: idx > 0 ? list[idx - 1]! : null,
      nextLecture: idx < list.length - 1 ? list[idx + 1]! : null,
    };
  }, [week?.lectures, lectureId]);

  // shared selected-text state (used by both Tutor and Practice)
  const [selectedText, setSelectedText] = useState("");
  const articleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onSelect() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text) return;
      // only capture selections that are inside the article
      if (!articleRef.current) return;
      const anchor = sel.anchorNode;
      if (anchor && articleRef.current.contains(anchor)) {
        setSelectedText(text.slice(0, 800));
      }
    }
    document.addEventListener("mouseup", onSelect);
    document.addEventListener("keyup", onSelect);
    return () => {
      document.removeEventListener("mouseup", onSelect);
      document.removeEventListener("keyup", onSelect);
    };
  }, []);

  const [tab, setTab] = useState<"tutor" | "practice">("tutor");
  const [level, setLevel] = useState<
    "highlights" | "short" | "medium" | "long" | "custom"
  >("highlights");
  const qc = useQueryClient();
  const [generating, setGenerating] = useState<"medium" | "long" | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // "Rewrite with lots of examples" — a per-length toggle. When on, the body for
  // the current base length is shown augmented with at least one vivid example
  // per point. Cached per length on the server so toggling is instant.
  const generateExamples = useGenerateLectureExamples();
  // Per-length on/off state, so each length remembers its own examples toggle.
  const [examplesOnByLevel, setExamplesOnByLevel] = useState<{
    short: boolean;
    medium: boolean;
    long: boolean;
  }>({ short: false, medium: false, long: false });
  const [examplesError, setExamplesError] = useState<string | null>(null);
  // The base length the examples toggle applies to (custom has no examples mode).
  const examplesLevel: "short" | "medium" | "long" | null =
    level === "custom" || level === "highlights" ? null : level;
  const examplesField =
    examplesLevel === "long"
      ? "bodyLongExamples"
      : examplesLevel === "medium"
        ? "bodyMediumExamples"
        : examplesLevel === "short"
          ? "bodyShortExamples"
          : null;
  const examplesReady = !!(examplesField && lecture?.[examplesField]);
  const examplesOn = examplesLevel ? examplesOnByLevel[examplesLevel] : false;

  function setExamplesForLevel(lvl: "short" | "medium" | "long", on: boolean) {
    setExamplesOnByLevel((prev) => ({ ...prev, [lvl]: on }));
  }

  async function toggleExamples() {
    if (!lecture || !examplesLevel) return;
    // Turning off is always instant.
    if (examplesOn) {
      setExamplesForLevel(examplesLevel, false);
      return;
    }
    setExamplesError(null);
    // Already cached for this length — show immediately.
    if (examplesReady) {
      setExamplesForLevel(examplesLevel, true);
      return;
    }
    try {
      await generateExamples.mutateAsync({
        lectureId: lecture.id,
        data: { level: examplesLevel },
      });
      await qc.invalidateQueries();
      setExamplesForLevel(examplesLevel, true);
    } catch (e) {
      setExamplesError(
        `Could not add examples to the ${examplesLevel} version: ${(e as Error).message}. Please try again.`,
      );
    }
  }

  // Reader-directed rewrite ("rewrite this lecture to …")
  const rewrite = useRewriteLecture();
  const clearRewrite = useClearLectureRewrite();
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteText, setRewriteText] = useState("");
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const REWRITE_PRESETS = [
    "Use shorter, simpler sentences",
    "Add more examples to the hardest section",
    "Illustrate the key principle with a concrete case",
    "Explain it like I'm new to philosophy",
  ];

  async function submitRewrite() {
    if (!lecture) return;
    const instruction = rewriteText.trim();
    if (!instruction) return;
    setRewriteError(null);
    try {
      await rewrite.mutateAsync({
        lectureId: lecture.id,
        data: {
          instruction,
          baseLevel: level === "highlights" ? "short" : level,
        },
      });
      await qc.invalidateQueries();
      setLevel("custom");
      setRewriteText("");
      setRewriteOpen(false);
    } catch (e) {
      setRewriteError(
        `Could not rewrite the lecture: ${(e as Error).message}. Try rephrasing your instruction.`,
      );
    }
  }

  async function revertRewrite() {
    if (!lecture) return;
    setRewriteError(null);
    try {
      await clearRewrite.mutateAsync({ lectureId: lecture.id });
      await qc.invalidateQueries();
      setLevel("short");
      setRewriteOpen(false);
    } catch (e) {
      setRewriteError(`Could not revert: ${(e as Error).message}`);
    }
  }

  const availableLevels = useMemo(() => {
    const out: Array<
      "highlights" | "short" | "medium" | "long" | "custom"
    > = ["highlights", "short"];
    if (lecture?.bodyMedium) out.push("medium");
    if (lecture?.bodyLong) out.push("long");
    if (lecture?.bodyCustom) out.push("custom");
    return out;
  }, [lecture?.bodyMedium, lecture?.bodyLong, lecture?.bodyCustom]);

  // When a fresh custom rewrite lands, surface it automatically.
  useEffect(() => {
    if (lecture?.bodyCustom) setLevel("custom");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture?.id]);

  async function generateLevel(target: "medium" | "long") {
    if (!lecture || generating) return;
    setGenError(null);
    setGenerating(target);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/diagnostics/expand-lectures?level=${target}&id=${lecture.id}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { updated?: number; failed?: number };
      if (!data.updated) {
        throw new Error("The model returned an unusable rewrite — please try again.");
      }
      await qc.invalidateQueries();
      setLevel(target);
    } catch (e) {
      setGenError(
        `Could not generate the ${target} version: ${(e as Error).message}`,
      );
    } finally {
      setGenerating(null);
    }
  }

  // Each length keeps its own examples toggle; switching length just clears any
  // stale error banner (the per-length on/off state persists in state).
  useEffect(() => {
    setExamplesError(null);
  }, [level]);

  const baseBody =
    level === "highlights"
      ? buildHighlightsMarkdown(lecture?.body ?? "")
      : level === "custom" && lecture?.bodyCustom
      ? lecture.bodyCustom
      : level === "long" && lecture?.bodyLong
        ? lecture.bodyLong
        : level === "medium" && lecture?.bodyMedium
          ? lecture.bodyMedium
          : (lecture?.body ?? "");

  const activeBody =
    examplesOn && examplesField && lecture?.[examplesField]
      ? (lecture[examplesField] as string)
      : baseBody;

  return (
    <Layout>
      <div className="px-6 pt-4 pb-2">
        <Link href={lecture ? `/weeks/${lecture.weekNumber}` : "/"}>
          <Button variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Day {lecture?.weekNumber ?? ""}
          </Button>
        </Link>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
        {/* LEFT: lecture */}
        <div className="overflow-y-auto px-8 pb-16 border-r border-border">
          {isLoading ? (
            <div className="flex flex-col gap-6 mt-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : lecture ? (
            <article>
              <header className="mb-6 mt-2">
                <h1 className="text-3xl font-serif font-bold text-primary mb-3 leading-tight">
                  {lecture.title}
                </h1>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Day {lecture.weekNumber}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
                      {(["highlights", "short", "medium", "long", "custom"] as const).map((lvl) => {
                        // The custom pill only exists once a rewrite has been made.
                        if (lvl === "custom" && !lecture.bodyCustom) return null;
                        const enabled = availableLevels.includes(lvl);
                        const active = level === lvl;
                        const isGenerating =
                          (lvl === "medium" || lvl === "long") && generating === lvl;
                        const onClick = () => {
                          if (generating) return;
                          if (enabled) {
                            setLevel(lvl);
                          } else if (lvl === "medium" || lvl === "long") {
                            generateLevel(lvl);
                          }
                        };
                        return (
                          <button
                            key={lvl}
                            onClick={onClick}
                            disabled={!!generating}
                            title={
                              lvl === "custom"
                                ? "Your rewritten version"
                                : enabled
                                  ? `${lvl[0].toUpperCase() + lvl.slice(1)} version`
                                  : `Generate the ${lvl} version of this lecture (takes ~30 seconds)`
                            }
                            className={`px-3 py-1.5 font-medium uppercase tracking-wider transition-colors disabled:opacity-60 ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : enabled
                                  ? "bg-background hover:bg-secondary text-foreground"
                                  : "bg-background hover:bg-secondary text-muted-foreground"
                            } border-r border-border last:border-r-0`}
                            data-testid={`button-level-${lvl}`}
                          >
                            {isGenerating ? (
                              <span className="inline-flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                {lvl}…
                              </span>
                            ) : lvl === "custom" ? (
                              <span className="inline-flex items-center gap-1">
                                <Wand2 className="w-3 h-3" />
                                yours
                              </span>
                            ) : !enabled && lvl !== "short" ? (
                              <span className="inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {lvl}
                              </span>
                            ) : (
                              lvl
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {examplesLevel && (
                      <Button
                        size="sm"
                        variant={examplesOn ? "default" : "outline"}
                        className="h-8 text-xs"
                        onClick={toggleExamples}
                        disabled={generateExamples.isPending}
                        title={
                          examplesOn
                            ? "Show the plain version without the extra examples"
                            : `Rewrite the ${examplesLevel} version with lots of vivid examples`
                        }
                        data-testid="button-examples-toggle"
                      >
                        {generateExamples.isPending ? (
                          <span className="inline-flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Adding examples…
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            {examplesOn ? "Examples on" : "Add examples"}
                          </span>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={rewriteOpen ? "secondary" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => {
                        setRewriteError(null);
                        setRewriteOpen((o) => !o);
                      }}
                      data-testid="button-rewrite-toggle"
                    >
                      <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                      Rewrite this lecture
                    </Button>
                  </div>
                </div>
              </header>

              {rewriteOpen && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="text-sm font-semibold text-foreground mb-1 inline-flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    Rewrite this lecture your way
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Tell the course how to rewrite this lecture — add more
                    examples on a point, illustrate a principle more clearly, use
                    shorter sentences. It keeps every concept, just presented your
                    way. Rewrites from the{" "}
                    <span className="font-medium uppercase">{level}</span> version
                    you're reading now.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {REWRITE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRewriteText(p)}
                        disabled={rewrite.isPending}
                        className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-secondary text-foreground disabled:opacity-60"
                        data-testid="button-rewrite-preset"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rewriteText}
                    onChange={(e) => setRewriteText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        submitRewrite();
                      }
                    }}
                    placeholder="e.g. Add two more worked examples to the section on intrinsic vs. instrumental goodness, and use shorter sentences throughout."
                    rows={3}
                    maxLength={1000}
                    disabled={rewrite.isPending}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y disabled:opacity-60"
                    data-testid="input-rewrite-instruction"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={submitRewrite}
                      disabled={!rewriteText.trim() || rewrite.isPending}
                      data-testid="button-rewrite-submit"
                    >
                      {rewrite.isPending ? (
                        <span className="inline-flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Rewriting…
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5" />
                          {lecture.bodyCustom ? "Refine again" : "Rewrite"}
                        </span>
                      )}
                    </Button>
                    {lecture.bodyCustom && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={revertRewrite}
                        disabled={rewrite.isPending || clearRewrite.isPending}
                        data-testid="button-rewrite-revert"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Revert to original
                      </Button>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      ⌘/Ctrl + Enter
                    </span>
                  </div>
                </div>
              )}

              {lecture.customInstruction && level === "custom" && !rewriteOpen && (
                <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="flex-1">
                    Showing your rewrite:{" "}
                    <span className="italic">"{lecture.customInstruction}"</span>
                  </span>
                  <button
                    onClick={revertRewrite}
                    disabled={clearRewrite.isPending}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-60"
                    data-testid="button-rewrite-revert-inline"
                  >
                    <RotateCcw className="w-3 h-3" /> revert
                  </button>
                </div>
              )}
              {rewriteError && (
                <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {rewriteError}
                </div>
              )}
              {genError && (
                <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {genError}
                </div>
              )}
              {examplesError && (
                <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {examplesError}
                </div>
              )}
              {generateExamples.isPending && (
                <div className="mb-3 rounded-md border border-chart-2/40 bg-chart-2/5 px-3 py-2 text-sm text-foreground inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Adding vivid examples to the {examplesLevel} version — about 30
                  seconds. It keeps everything you're reading and just adds
                  illustrations.
                </div>
              )}
              {examplesOn && !generateExamples.isPending && (
                <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="flex-1">
                    Showing the{" "}
                    <span className="font-medium uppercase">{examplesLevel}</span>{" "}
                    version with extra examples added to every point.
                  </span>
                  <button
                    onClick={() =>
                      examplesLevel && setExamplesForLevel(examplesLevel, false)
                    }
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    data-testid="button-examples-off"
                  >
                    <X className="w-3 h-3" /> plain
                  </button>
                </div>
              )}
              {generating && (
                <div className="mb-3 rounded-md border border-chart-2/40 bg-chart-2/5 px-3 py-2 text-sm text-foreground inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Writing the {generating} version of this lecture — about 30
                  seconds. You can keep reading the short version meanwhile.
                </div>
              )}
              <div className="bg-card border shadow-sm rounded-lg p-6 md:p-8" ref={articleRef}>
                <MarkdownRenderer content={activeBody} />
                <div className="mt-6 pt-4 border-t border-dashed border-border text-xs text-muted-foreground italic">
                  Tip: highlight any passage above to ask the tutor about it, or to generate practice problems specifically on what you selected.
                </div>
              </div>

              {!!week?.assignments.length && (
                <section
                  className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4"
                  data-testid="section-related-assignments"
                >
                  <h2 className="font-serif text-lg font-bold text-primary">
                    Related assignments
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Go straight from this lecture to the course work that applies it.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {week.assignments.map((assignment) => (
                      <Link
                        key={assignment.id}
                        href={`/assignments/${assignment.id}`}
                        data-testid={`link-related-assignment-${assignment.id}`}
                      >
                        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-primary/60 hover:bg-secondary">
                          <span>
                            <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {assignment.kind}
                            </span>
                            {assignment.title}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {(prevLecture || nextLecture) && (
                <nav className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {prevLecture ? (
                    <Link href={`/lectures/${prevLecture.id}`}>
                      <button
                        className="group w-full h-full text-left rounded-lg border border-border bg-card hover:border-primary/50 transition-colors p-4 flex items-center gap-3"
                        data-testid="button-prev-lecture"
                      >
                        <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          Previous
                        </span>
                      </button>
                    </Link>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                  {nextLecture && (
                    <Link href={`/lectures/${nextLecture.id}`} className="sm:col-start-2">
                      <button
                        className="group w-full h-full text-right rounded-lg border border-primary/40 bg-primary/5 hover:border-primary transition-colors p-4 flex items-center justify-end gap-3"
                        data-testid="button-next-lecture"
                      >
                        <span className="text-xs uppercase tracking-wider text-primary/80">
                          Next lecture
                        </span>
                        <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                      </button>
                    </Link>
                  )}
                </nav>
              )}
            </article>
          ) : (
            <div className="mt-8">Lecture not found.</div>
          )}
        </div>

        {/* RIGHT: practice + tutor */}
        <div className="flex flex-col min-h-0 bg-secondary/20">
          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("tutor")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                  tab === "tutor" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
                data-testid="tab-tutor"
              >
                <MessageSquare className="w-4 h-4" />
                Ask the tutor
              </button>
              <button
                onClick={() => setTab("practice")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                  tab === "practice" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
                data-testid="tab-practice"
              >
                <Sparkles className="w-4 h-4" />
                Practice on this
              </button>
            </div>
            {selectedText && (
              <button
                onClick={() => setSelectedText("")}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> clear selection
              </button>
            )}
          </div>

          {selectedText && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
              <div className="font-semibold mb-0.5">Using your highlighted text:</div>
              <div className="line-clamp-2 italic">"{selectedText}"</div>
            </div>
          )}

          {tab === "tutor" ? (
            <TutorPane
              lectureId={lecture?.id ?? null}
              selectedText={selectedText}
              onUsedSelection={() => {/* keep selection visible */}}
            />
          ) : (
            <PracticePane
              lectureId={lecture?.id ?? null}
              topicId={lecture?.topicId ?? null}
              weekNumber={lecture?.weekNumber ?? null}
              selectedText={selectedText}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

/* ============ Tutor pane ============ */
function TutorPane({
  lectureId,
  selectedText,
  onUsedSelection,
}: {
  lectureId: number | null;
  selectedText: string;
  onUsedSelection: () => void;
}) {
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const ask = useAskTutor();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleMathInsert = (text: string, cursorBack = 0) => {
    const el = inputRef.current;
    if (!el) {
      setInput((v) => v + text);
      return;
    }
    const { value, cursor } = insertAtTextareaCursor(el, text, cursorBack);
    setInput(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  // Preloaded starter questions for this lecture
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (lectureId == null) return;
    setSuggestions(null);
    setSuggestionsDismissed(false);
    setDismissed(new Set());
    setSuggestionsLoading(true);
    fetch(`/api/tutor/suggestions/${lectureId}?t=${Date.now()}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return { questions: [] };
        return r.json() as Promise<{ questions?: string[] }>;
      })
      .then((data: { questions?: string[] }) => {
        setSuggestions(data.questions ?? []);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }, [lectureId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [history.length, ask.isPending]);

  const placeholder = selectedText
    ? "Ask about the highlighted passage…"
    : "Ask anything about this lecture… (Shift+Enter for newline)";

  function sendMessage(msg: string, displayOverride?: string) {
    const text = msg.trim();
    if (!text) return;
    const shown = (displayOverride ?? msg).trim();
    setHistory((h) => [...h, { role: "user", text: shown }]);
    ask.mutate(
      {
        data: {
          message: text,
          lectureId: lectureId ?? undefined,
          selectedLectureText: selectedText || undefined,
        },
      },
      {
        onSuccess: (res) => {
          setHistory((h) => [...h, { role: "tutor", text: res.text }]);
          onUsedSelection();
        },
        onError: (e) => {
          setHistory((h) => [
            ...h,
            { role: "tutor", text: `Tutor error: ${(e as Error).message}` },
          ]);
        },
      },
    );
  }

  function send() {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    sendMessage(msg);
  }

  function submitAttempt(question: string, attempt: string) {
    const a = attempt.trim();
    if (!a) return;
    // The student sees only their own answer; the question + grading
    // instructions are sent to the tutor as hidden context.
    const backendMessage =
      `The student is answering this starter question: "${question}"\n\n` +
      `Their answer: "${a}"\n\n` +
      `Tell them whether it's correct, partly correct, or wrong, point to the ` +
      `specific part of their reasoning that's right or off, then give the ` +
      `correct answer with a brief worked example. Keep it tight.`;
    sendMessage(backendMessage, a);
  }

  const visibleSuggestions = (suggestions ?? []).filter((_, i) => !dismissed.has(i));
  const showSuggestions =
    !suggestionsDismissed && (suggestionsLoading || visibleSuggestions.length > 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-border bg-background p-3 flex flex-col gap-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={placeholder}
            rows={4}
            className="flex-1 bg-secondary border-none rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[96px] max-h-[280px]"
            data-testid="input-tutor-question"
          />
          <Button size="lg" onClick={send} disabled={!input.trim() || ask.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <MathKeyboard onInsert={handleMathInsert} />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {showSuggestions && (
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Starter questions for this section
              </div>
              <button
                onClick={() => setSuggestionsDismissed(true)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                data-testid="button-dismiss-all-suggestions"
              >
                <X className="w-3 h-3" /> dismiss all
              </button>
            </div>
            {suggestionsLoading ? (
              <div className="text-sm text-muted-foreground italic">
                Generating starter questions…
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(suggestions ?? []).map((q, i) => {
                  if (dismissed.has(i)) return null;
                  return (
                    <StarterQuestionCard
                      key={i}
                      index={i}
                      question={q}
                      pending={ask.isPending}
                      onSubmitAttempt={(attempt) => submitAttempt(q, attempt)}
                      onShowAnswer={() => sendMessage(q)}
                      onDismiss={() =>
                        setDismissed((d) => {
                          const n = new Set(d);
                          n.add(i);
                          return n;
                        })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {history.length === 0 && !showSuggestions && (
          <div className="m-auto text-center text-sm text-muted-foreground italic max-w-sm">
            Ask the tutor for an explanation, a worked example, or a hint. Highlight a passage on the left to ground the question in that text.
          </div>
        )}

        {history.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] ${m.role === "user" ? "self-end" : "self-start"}`}
          >
            <div
              className={`px-3 py-2 rounded-lg text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              <MarkdownRenderer content={m.text} inverted={m.role === "user"} />
            </div>
          </div>
        ))}
        {ask.isPending && (
          <div className="self-start px-3 py-2 rounded-lg bg-card border border-border text-sm animate-pulse text-muted-foreground">
            Thinking…
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Practice pane (inline, scoped to this lecture's topic) ============ */
function PracticePane({
  lectureId,
  topicId,
  weekNumber,
  selectedText,
}: {
  lectureId: number | null;
  topicId: number | null;
  weekNumber: number | null;
  selectedText: string;
}) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [problem, setProblem] = useState<PracticeProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<PracticeGrade | null>(null);
  const [trace, setTrace] = useState<KeystrokeTrace>({
    keystrokeCount: 0,
    eraseCount: 0,
    durationMs: 0,
  });

  const start = useStartPracticeSession();
  const next = useNextPracticeProblem();
  const grader = useGradePracticeAnswer();

  // auto-start a session scoped to this lecture's topic
  useEffect(() => {
    if (sessionId != null || topicId == null) return;
    start.mutate(
      {
        data: {
          tutorEnabled: true,
          focusOnWeaknesses: false,
          topicId,
          weekNumber: weekNumber ?? undefined,
        },
      },
      {
        onSuccess: (s) => {
          setSessionId(s.id);
          loadNext(s.id);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const requestText = useMemo(() => {
    return selectedText
      ? `Make a problem that drills exactly this passage from the lecture:\n"""${selectedText}"""`
      : "";
  }, [selectedText]);

  function loadNext(sid: number) {
    setAnswer("");
    setGrade(null);
    setTrace({ keystrokeCount: 0, eraseCount: 0, durationMs: 0 });
    setProblem(null);
    next.mutate(
      {
        sessionId: sid,
        data: { topicId: topicId ?? undefined, request: requestText || undefined },
      },
      { onSuccess: (p) => setProblem(p) },
    );
  }

  function submit() {
    if (!sessionId || !problem) return;
    grader.mutate(
      { sessionId, data: { problemId: problem.id, answer, trace } },
      { onSuccess: (r) => setGrade(r) },
    );
  }

  if (topicId == null) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8">
        Loading lecture…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Practice · {problem?.topicTitle ?? "this lecture"}
            {problem?.difficulty != null && (
              <span className="ml-2 normal-case font-normal">
                · difficulty {problem.difficulty.toFixed(1)}/5
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => sessionId && loadNext(sessionId)}
            disabled={next.isPending || grader.isPending}
            data-testid="button-new-problem"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            New problem
          </Button>
        </div>

        {selectedText && (
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-2">
            The next problem you generate will be drilled specifically on the passage you highlighted. Click <strong>New problem</strong> to regenerate.
          </div>
        )}

        <div className="bg-card border rounded-lg p-4 min-h-[120px]">
          {next.isPending || !problem ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <MarkdownRenderer content={problem.prompt} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <AnswerInput
            value={answer}
            onChange={(val, t) => {
              setAnswer(val);
              setTrace(t);
            }}
            disabled={!!grade || !problem}
          />
        </div>

        {grade ? (
          <div
            className={`rounded-md border p-3 ${
              grade.correct
                ? "bg-emerald-50 border-emerald-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <div
              className={`flex items-center gap-2 font-semibold mb-2 ${
                grade.correct ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {grade.correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {grade.correct ? "Correct" : "Not quite"}
            </div>
            <div className="text-sm prose prose-sm max-w-none">
              <MarkdownRenderer content={grade.explanation} />
            </div>
            {grade.tutorTip && (
              <div className="mt-2 pt-2 border-t border-border/60 text-sm italic text-muted-foreground">
                Tutor tip: {grade.tutorTip}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => sessionId && loadNext(sessionId)}
                disabled={next.isPending}
                data-testid="button-next-after-grade"
              >
                Next problem
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              onClick={submit}
              disabled={!answer.trim() || grader.isPending || !problem}
              data-testid="button-submit-practice"
            >
              {grader.isPending ? "Grading…" : "Submit answer"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
