import React from "react";
import { useGetGradebook } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";

const PHASE_SHORT: Record<string, string> = {
  before: "Before the course",
  third: "One-third through",
  twothirds: "Two-thirds through",
  after: "After the course",
};

const INSTRUMENT_SHORT: Record<string, string> = {
  subject: "Integration Cases",
  general: "General Reasoning",
};

function statusPill(status: string) {
  const passed = status === "passed" || status === "submitted";
  const cls = passed
    ? "bg-chart-2/15 text-chart-2"
    : status === "in_progress"
    ? "bg-chart-4/20 text-chart-4"
    : "bg-secondary text-secondary-foreground";
  const label = passed ? (status === "passed" ? "completed" : "submitted") : status.replace("_", " ");
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function Grades() {
  const { data: gb, isLoading } = useGetGradebook();
  const { isSignedIn } = useAuth();
  const courseComplete =
    Boolean(gb?.coursework.length) &&
    gb!.coursework.every((assignment) => assignment.status === "submitted");
  const certificatePassed = courseComplete && (gb?.overallPercent ?? 0) >= 60;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto w-full flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Grades</h1>
          <p className="text-muted-foreground">
            Your course grade is 100% coursework. Diagnostic checks are ungraded
            practice and never affect your grade.
          </p>
        </div>

        {isLoading || !gb ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Overall grade
                  </div>
                  <div className="text-4xl font-serif font-bold text-primary">
                    {gb.overallPercent}%
                  </div>
                </div>
                <div className="text-6xl font-serif font-bold text-primary/80">
                  {gb.letterGrade}
                </div>
              </CardContent>
            </Card>

            {courseComplete && (
              <Card className={certificatePassed ? "border-primary/30" : "border-destructive/30"}>
                <CardHeader>
                  <CardTitle>
                    Certificate status: {certificatePassed ? "Passed" : "Not passed"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {certificatePassed
                      ? "Your personalized Evolutionary Psychology Level 1 certificate is ready."
                      : "A coursework average of at least 60% is required for the certificate."}
                  </p>
                  {certificatePassed && isSignedIn ? (
                    <a
                      href="/api/certificate/download"
                      className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      data-testid="button-download-certificate"
                    >
                      Download certificate
                    </a>
                  ) : certificatePassed ? (
                    <p className="text-sm font-medium">
                      Sign in with Google to download your named certificate.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gb.components.map((c) => (
                <Card key={c.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      {c.label} · {c.weightPercent}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-serif font-bold mb-1">
                      {c.earnedPercent} / {c.weightPercent}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-serif font-semibold border-b pb-2">Coursework</h2>
              <div className="flex flex-col divide-y border rounded-md">
                {gb.coursework.map((a) => (
                  <Link key={a.id} href={`/assignments/${a.id}`}>
                    <div className="p-4 flex items-center justify-between hover:bg-secondary/50 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium">{a.title}</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          {a.kind} · Day {a.weekNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.bestScore !== null && a.bestScore !== undefined && (
                          <span className="font-semibold">{Math.round(a.bestScore)}%</span>
                        )}
                        {statusPill(a.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-serif font-semibold border-b pb-2">
                Diagnostic Checks{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  (ungraded practice)
                </span>
              </h2>
              <div className="flex flex-col divide-y border rounded-md">
                {gb.reasoning.map((r) => (
                  <Link key={r.id} href="/reasoning">
                    <div className="p-4 flex items-center justify-between hover:bg-secondary/50 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium">{r.title}</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          {INSTRUMENT_SHORT[r.instrument] ?? r.instrument} ·{" "}
                          {PHASE_SHORT[r.phase] ?? r.phase}
                        </span>
                      </div>
                      {statusPill(r.status)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
