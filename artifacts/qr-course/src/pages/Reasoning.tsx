import React from "react";
import { useListReasoningAssessments } from "@workspace/api-client-react";
import type { ReasoningAssessmentSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, Brain } from "lucide-react";

type Instrument = "subject" | "general";

const PHASE_LABELS: Record<string, string> = {
  before: "Before the course",
  third: "One-third of the way through",
  twothirds: "Two-thirds of the way through",
  after: "After the course",
};

const PHASE_ORDER = ["before", "third", "twothirds", "after"];

const INSTRUMENT_ORDER: Instrument[] = ["subject", "general"];

const INSTRUMENT_LABELS: Record<Instrument, string> = {
  subject: "Evolutionary Psychology Cases",
  general: "General Reasoning",
};

const INSTRUMENT_BLURBS: Record<Instrument, string> = {
  subject:
    "Diagnose realistic evolutionary psychology cases by naming the deciding concept and evidence.",
  general:
    "Apply analysis, inference, evaluation, deduction, and induction to evolutionary psychology mechanisms.",
};

type Format = "mcq" | "hybrid" | "written";

const FORMAT_ORDER: Format[] = ["mcq", "hybrid", "written"];

const FORMAT_LABELS: Record<Format, string> = {
  mcq: "Multiple Choice",
  hybrid: "Hybrid",
  written: "Written",
};

const FORMAT_BLURBS: Record<Format, string> = {
  mcq: "Pick the single best option.",
  hybrid: "Pick the best option and explain your reasoning.",
  written: "Write a short answer in your own words — no options.",
};

type TestLength = "short" | "medium" | "long";
const LENGTH_ORDER: TestLength[] = ["short", "medium", "long"];
const LENGTH_LABELS: Record<TestLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};
// Question count per length, per instrument. Mirrors LENGTH_COUNTS in
// api-server/src/lib/reasoning.ts and ReasoningRunner.tsx — keep in lockstep.
const LENGTH_COUNTS: Record<Instrument, Record<TestLength, number>> = {
  subject: { short: 4, medium: 8, long: 12 },
  general: { short: 4, medium: 8, long: 12 },
};

function statusBadge(status: string) {
  const cls =
    status === "passed"
      ? "bg-chart-2/15 text-chart-2"
      : status === "in_progress"
      ? "bg-chart-4/20 text-chart-4"
      : "bg-secondary text-secondary-foreground";
  const label =
    status === "passed"
      ? "completed"
      : status === "in_progress"
      ? "in progress"
      : "not taken";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

function InstrumentCard({
  instrument,
  versions,
}: {
  instrument: Instrument;
  versions: ReasoningAssessmentSummary[];
}) {
  const Icon = instrument === "subject" ? Scale : Brain;
  const byFormat = new Map<Format, ReasoningAssessmentSummary>();
  for (const v of versions) byFormat.set(v.format as Format, v);

  return (
    <Card className="flex flex-col" data-testid={`card-reasoning-${instrument}`}>
      <CardHeader>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          <Icon className="w-3.5 h-3.5" />
          {INSTRUMENT_LABELS[instrument]}
        </span>
        <CardTitle className="text-base leading-snug">
          {INSTRUMENT_BLURBS[instrument]}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Choose a format and a length — every attempt has fresh questions:
        </p>
        <div className="flex flex-col gap-3">
          {FORMAT_ORDER.map((fmt) => {
            const a = byFormat.get(fmt);
            if (!a) return null;
            const counts = LENGTH_COUNTS[instrument];
            return (
              <div
                key={fmt}
                className="rounded-md border border-border p-3 flex flex-col gap-2.5"
                data-testid={`format-block-reasoning-${a.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {FORMAT_LABELS[fmt]}
                      </span>
                      {statusBadge(a.status)}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {FORMAT_BLURBS[fmt]}
                    </span>
                  </span>
                  {a.status === "passed" ? (
                    <Link href={`/reasoning/${a.id}`}>
                      <span
                        className="text-xs font-medium text-primary shrink-0 hover:underline cursor-pointer"
                        data-testid={`link-review-reasoning-${a.id}`}
                      >
                        Review
                      </span>
                    </Link>
                  ) : a.status === "in_progress" ? (
                    <Link href={`/reasoning/${a.id}`}>
                      <span
                        className="text-xs font-medium text-primary shrink-0 hover:underline cursor-pointer"
                        data-testid={`link-resume-reasoning-${a.id}`}
                      >
                        Resume
                      </span>
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Choose a length to start
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {LENGTH_ORDER.map((len) => (
                      <Link
                        key={len}
                        href={`/reasoning/${a.id}?length=${len}`}
                        className="block"
                      >
                        <button
                          type="button"
                          className="w-full rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors px-2 py-2 text-center"
                          data-testid={`button-length-${a.id}-${len}`}
                        >
                          <span className="block text-xs font-semibold">
                            {LENGTH_LABELS[len]}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {counts[len]}{" "}
                            {counts[len] === 1 ? "question" : "questions"}
                          </span>
                        </button>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reasoning() {
  const { data: assessments, isLoading } = useListReasoningAssessments();

  // phase -> instrument -> versions (one per format)
  const byPhase = (assessments ?? []).reduce((acc, a) => {
    (acc[a.phase] ||= {} as Record<string, ReasoningAssessmentSummary[]>);
    (acc[a.phase]![a.instrument] ||= []).push(a);
    return acc;
  }, {} as Record<string, Record<string, ReasoningAssessmentSummary[]>>);

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto w-full flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">
            Diagnostic Checks
          </h1>
          <p className="text-muted-foreground">
            Two kinds of check — <strong>Evolutionary Psychology Cases</strong> (about the
            course material) and <strong>General Reasoning</strong> — offered at
            four points in your journey: before the course, one-third through,
            two-thirds through, and after. Pick any one anytime, in the format
            (Multiple Choice, Hybrid, or Written) and length (Short, Medium, or
            Long) you like. These are <strong>ungraded practice</strong>: take
            them as many times as you want — the questions are different every
            time — and they never affect your course grade.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {PHASE_ORDER.filter((p) => byPhase[p]).map((phase) => (
              <div key={phase} className="flex flex-col gap-4">
                <h2 className="text-xl font-serif font-semibold border-b pb-2">
                  {PHASE_LABELS[phase] ?? phase}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {INSTRUMENT_ORDER.filter(
                    (inst) => byPhase[phase]![inst]?.length,
                  ).map((inst) => (
                    <InstrumentCard
                      key={inst}
                      instrument={inst}
                      versions={byPhase[phase]![inst]!}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
