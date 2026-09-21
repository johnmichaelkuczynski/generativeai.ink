import React from "react";
import {
  useGetCertificateStatus,
  useGetGradebook,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Award, Download } from "lucide-react";

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
  const { data: certificate, isLoading: certificateLoading } =
    useGetCertificateStatus();
  const courseComplete = certificate?.complete ?? false;
  const certificatePassed = certificate?.passed ?? false;
  const issuedDate = certificate?.issuedDate
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${certificate.issuedDate}T00:00:00.000Z`))
    : null;

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

            {certificateLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : courseComplete ? (
              <Card className={certificatePassed ? "border-primary/30" : "border-destructive/30"}>
                <CardHeader>
                  <CardTitle>
                    Certificate status: {certificatePassed ? "Passed" : "Not passed"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {certificatePassed && certificate?.signedIn ? (
                    <>
                      <div
                        className="relative overflow-hidden rounded-lg border-4 border-double border-primary/70 bg-[radial-gradient(circle_at_top,#ffffff_0%,#faf7ef_58%,#f2ead8_100%)] px-6 py-9 text-center text-slate-900 shadow-sm sm:px-12"
                        data-testid="certificate-display"
                      >
                        <div className="pointer-events-none absolute inset-3 border border-amber-600/40" />
                        <div className="relative flex flex-col items-center">
                          <Award className="mb-3 h-10 w-10 text-amber-700" aria-hidden="true" />
                          <div className="text-sm font-bold tracking-[0.3em] text-amber-800">
                            ZHI SYSTEMS
                          </div>
                          <div className="mt-3 font-serif text-3xl font-bold uppercase tracking-wide text-primary sm:text-4xl">
                            Certificate of Completion
                          </div>
                          <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            This certificate is awarded to
                          </div>
                          <div className="mt-3 border-b border-amber-700/50 px-8 pb-2 font-serif text-2xl font-bold text-primary sm:text-3xl">
                            {certificate.recipientName}
                          </div>
                          <div className="mt-5 text-base font-semibold uppercase tracking-wide sm:text-lg">
                            In Evolutionary Psychology Series 1
                          </div>
                          <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-600">
                            {issuedDate && <span>Issued {issuedDate}</span>}
                            <span>Final grade {Math.round(certificate.overallPercent)}%</span>
                          </div>
                          <div className="mt-2 font-mono text-[11px] tracking-wide text-slate-500">
                            Certificate No. {certificate.certificateNumber}
                          </div>
                        </div>
                      </div>

                      <a
                        href="/api/certificate/download"
                        className="mt-2 inline-flex w-fit items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        data-testid="button-download-certificate"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download certificate (PDF)
                      </a>
                    </>
                  ) : certificatePassed ? (
                    <p className="text-sm font-medium">
                      Sign in with Google to display and download your named certificate.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      A coursework average of at least{" "}
                      {certificate?.requiredPercent ?? 70}% (a grade of C or
                      better) is required for the certificate. Your current
                      average is {Math.round(certificate?.overallPercent ?? 0)}%.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

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
