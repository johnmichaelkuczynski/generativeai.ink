import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  PlayCircle,
  Activity,
  Database,
  RefreshCw,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import {
  useGenerateLongAnswerDiagnostic,
  useGradeLongAnswerDiagnostic,
  type LongAnswerDiagnosticGenerated,
  type LongAnswerDiagnosticResult,
} from "@workspace/api-client-react";

type Step = {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
  error?: string;
};
type RunResult = {
  ok: boolean;
  generatedAt: string;
  steps: Step[];
};

type DatabaseEvidence = {
  ok: true;
  provider: string;
  connectionSource: string;
  endpoint: string;
  database_name: string;
  database_size: string;
  checked_at: string;
  transaction_id: string;
  users: number;
  jmk_present: boolean;
  topics: number;
  lectures: number;
  assignments: number;
  problems: number;
  attempts: number;
  answers: number;
  practice_sessions: number;
  practice_attempts: number;
};

const API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`.replace(
  /^\/api/,
  "/api",
);

function apiUrl(path: string): string {
  // The api-server is mounted at /api at the proxy level, not under the artifact path.
  return `/api${path}`;
}

function StepRow({ s }: { s: Step }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      {s.ok ? (
        <CheckCircle2 className="w-5 h-5 text-green-700 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{s.name}</div>
        {s.detail && (
          <div className="text-xs text-muted-foreground mt-0.5 break-words">{s.detail}</div>
        )}
        {s.error && (
          <div className="text-xs text-red-700 mt-0.5 break-words font-mono">{s.error}</div>
        )}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums shrink-0">{s.ms} ms</div>
    </div>
  );
}

function ResultCard({ title, result }: { title: string; result: RunResult | null }) {
  if (!result) return null;
  const passed = result.steps.filter((s) => s.ok).length;
  const total = result.steps.length;
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="font-serif text-lg">{title}</div>
        <div
          className={`text-sm font-medium ${
            result.ok ? "text-green-700" : "text-red-700"
          }`}
        >
          {passed}/{total} passed
        </div>
      </div>
      <div className="px-5 py-2">
        {result.steps.map((s, i) => (
          <StepRow key={i} s={s} />
        ))}
      </div>
    </div>
  );
}

export default function Diagnostics() {
  const generateLongAnswer = useGenerateLongAnswerDiagnostic();
  const gradeLongAnswer = useGradeLongAnswerDiagnostic();
  const [sysBusy, setSysBusy] = useState(false);
  const [synthBusy, setSynthBusy] = useState(false);
  const [qcBusy, setQcBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [sysResult, setSysResult] = useState<RunResult | null>(null);
  const [synthResult, setSynthResult] = useState<RunResult | null>(null);
  const [qcResult, setQcResult] = useState<RunResult | null>(null);
  const [sysError, setSysError] = useState<string | null>(null);
  const [databaseEvidence, setDatabaseEvidence] =
    useState<DatabaseEvidence | null>(null);
  const [databaseEvidenceBusy, setDatabaseEvidenceBusy] = useState(true);
  const [databaseEvidenceError, setDatabaseEvidenceError] = useState<string | null>(
    null,
  );
  const [synthError, setSynthError] = useState<string | null>(null);
  const [qcError, setQcError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveStage, setLiveStage] = useState<
    "idle" | "generating" | "writing" | "grading" | "complete"
  >("idle");
  const [liveGenerated, setLiveGenerated] =
    useState<LongAnswerDiagnosticGenerated | null>(null);
  const [liveDisplayedAnswer, setLiveDisplayedAnswer] = useState("");
  const [liveResult, setLiveResult] =
    useState<LongAnswerDiagnosticResult | null>(null);

  const loadDatabaseEvidence = useCallback(async () => {
    setDatabaseEvidenceBusy(true);
    setDatabaseEvidenceError(null);
    try {
      const response = await fetch(apiUrl("/diagnostics/database-evidence"));
      const body = (await response.json()) as
        | DatabaseEvidence
        | { ok: false; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(
          "error" in body && body.error
            ? body.error
            : `Database evidence request failed with HTTP ${response.status}`,
        );
      }
      setDatabaseEvidence(body);
    } catch (error) {
      setDatabaseEvidence(null);
      setDatabaseEvidenceError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDatabaseEvidenceBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDatabaseEvidence();
  }, [loadDatabaseEvidence]);

  async function runSystem() {
    setSysBusy(true);
    setSysError(null);
    setSysResult(null);
    try {
      const r = await fetch(apiUrl("/diagnostics/system"));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSysResult(await r.json());
    } catch (e) {
      setSysError(e instanceof Error ? e.message : String(e));
    } finally {
      setSysBusy(false);
    }
  }

  async function runSynthetic() {
    setSynthBusy(true);
    setSynthError(null);
    setSynthResult(null);
    try {
      const r = await fetch(apiUrl("/diagnostics/synthetic-run"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSynthResult(await r.json());
    } catch (e) {
      setSynthError(e instanceof Error ? e.message : String(e));
    } finally {
      setSynthBusy(false);
    }
  }

  async function runQualityControl() {
    setQcBusy(true);
    setQcError(null);
    setQcResult(null);
    try {
      const r = await fetch(apiUrl("/diagnostics/quality-control"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setQcResult(await r.json());
    } catch (e) {
      setQcError(e instanceof Error ? e.message : String(e));
    } finally {
      setQcBusy(false);
    }
  }

  async function writeAnswerOnScreen(answer: string): Promise<void> {
    await new Promise<void>((resolve) => {
      let cursor = 0;
      const chunkSize = Math.max(1, Math.ceil(answer.length / 120));
      const timer = window.setInterval(() => {
        cursor = Math.min(answer.length, cursor + chunkSize);
        setLiveDisplayedAnswer(answer.slice(0, cursor));
        if (cursor >= answer.length) {
          window.clearInterval(timer);
          resolve();
        }
      }, 25);
    });
  }

  async function runLongAnswerDiagnostic() {
    setLiveBusy(true);
    setLiveError(null);
    setLiveGenerated(null);
    setLiveDisplayedAnswer("");
    setLiveResult(null);
    try {
      setLiveStage("generating");
      const generated = await generateLongAnswer.mutateAsync();
      setLiveGenerated(generated);

      setLiveStage("writing");
      await writeAnswerOnScreen(generated.answer);

      setLiveStage("grading");
      const graded = await gradeLongAnswer.mutateAsync({
        data: {
          problemId: generated.problemId,
          answer: generated.answer,
        },
      });
      setLiveResult(graded);
      setLiveStage("complete");
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : String(error));
      setLiveStage("idle");
    } finally {
      setLiveBusy(false);
    }
  }

  const liveButtonLabel =
    liveStage === "generating"
      ? "Generating…"
      : liveStage === "writing"
        ? "Writing on screen…"
        : liveStage === "grading"
          ? "Persisting and grading…"
          : "Run one-paragraph-maximum proof";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Diagnostics</h1>
          <p className="text-muted-foreground">
            Four self-tests to verify the course app is healthy end-to-end.
          </p>
        </div>

        <section
          className="rounded-lg border border-border bg-card overflow-hidden"
          data-testid="section-live-database-evidence"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-serif text-xl flex items-center gap-2">
                <Database className="w-5 h-5" /> Live database evidence
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A fresh SQL round trip from the running app to its configured database.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadDatabaseEvidence()}
              disabled={databaseEvidenceBusy}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background font-medium disabled:opacity-60"
              data-testid="button-refresh-database-evidence"
            >
              <RefreshCw
                className={`w-4 h-4 ${databaseEvidenceBusy ? "animate-spin" : ""}`}
              />
              {databaseEvidenceBusy ? "Checking…" : "Refresh evidence"}
            </button>
          </div>

          {databaseEvidenceError && (
            <div
              className="m-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800"
              role="alert"
              data-testid="status-database-evidence-error"
            >
              <div className="font-semibold">Database proof failed</div>
              <div className="mt-1 font-mono break-all">{databaseEvidenceError}</div>
            </div>
          )}

          {databaseEvidence && (
            <div className="p-5 space-y-4">
              <div
                className="flex items-center gap-2 text-sm font-semibold text-green-700"
                data-testid="status-database-connected"
              >
                <CheckCircle2 className="w-5 h-5" />
                Connected to {databaseEvidence.provider} now
              </div>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Connection source</dt>
                  <dd
                    className="font-mono break-all"
                    data-testid="text-database-connection-source"
                  >
                    {databaseEvidence.connectionSource}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Neon endpoint</dt>
                  <dd
                    className="font-mono break-all"
                    data-testid="text-database-endpoint"
                  >
                    {databaseEvidence.endpoint}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Database</dt>
                  <dd className="font-mono" data-testid="text-database-name">
                    {databaseEvidence.database_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stored size</dt>
                  <dd data-testid="text-database-size">
                    {databaseEvidence.database_size}
                    <span className="ml-2 text-muted-foreground">
                      (Neon rounds this to 0 GB)
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fresh SQL check</dt>
                  <dd data-testid="text-database-checked-at">
                    {new Date(databaseEvidence.checked_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">PostgreSQL transaction</dt>
                  <dd
                    className="font-mono"
                    data-testid="text-database-transaction-id"
                  >
                    {databaseEvidence.transaction_id}
                  </dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["Users", databaseEvidence.users],
                  ["Topics", databaseEvidence.topics],
                  ["Lectures", databaseEvidence.lectures],
                  ["Assignments", databaseEvidence.assignments],
                  ["Problems", databaseEvidence.problems],
                  ["Attempts", databaseEvidence.attempts],
                  ["Answers", databaseEvidence.answers],
                  [
                    "Practice records",
                    databaseEvidence.practice_sessions +
                      databaseEvidence.practice_attempts,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  >
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div
                      className="text-lg font-semibold tabular-nums"
                      data-testid={`text-database-count-${String(label)
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="text-sm text-muted-foreground"
                data-testid="text-database-jmk-present"
              >
                JMK database user:{" "}
                <span className="font-semibold text-foreground">
                  {databaseEvidence.jmk_present ? "present" : "missing"}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl flex items-center gap-2">
                <Activity className="w-5 h-5" /> Diagnostic 1 — System check
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Verifies database connectivity, content seed, OpenAI integration (chat + JSON
                mode), detection pipeline, and the grader. Takes a few seconds.
              </p>
            </div>
            <button
              onClick={runSystem}
              disabled={sysBusy}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {sysBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {sysBusy ? "Running…" : "Run system check"}
            </button>
          </div>
          {sysError && (
            <div className="text-sm text-red-700 font-mono">{sysError}</div>
          )}
          <ResultCard title="System check results" result={sysResult} />
        </section>

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl flex items-center gap-2">
                <Activity className="w-5 h-5" /> Diagnostic 2 — Synthetic student
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Walks a synthetic student through the whole course: reads every lecture,
                starts and submits every assignment (homework, tests, midterm, final), runs
                adaptive practice, asks the AI tutor, and triggers AI + diachronic detection.
                This exercises every endpoint a real student would touch and can take
                several minutes (each grade and generation is an LLM call). The AI detector
                will fire on the synthetic answers — that is the intended behavior.
              </p>
            </div>
            <button
              onClick={runSynthetic}
              disabled={synthBusy}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {synthBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {synthBusy ? "Running…" : "Run synthetic student"}
            </button>
          </div>
          {synthError && (
            <div className="text-sm text-red-700 font-mono">{synthError}</div>
          )}
          <ResultCard title="Synthetic student results" result={synthResult} />
        </section>

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Diagnostic 3 — Answer-key quality control
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Uses OpenAI to independently re-derive the answer to a sample of course
                problems across the entire course and verify that each seeded answer key is a
                legitimate, correct, and unambiguous answer to its prompt. Any key the model
                judges wrong, off-topic, or ambiguous is flagged before a student is ever
                graded against it. Each review is an LLM call, so this can take a minute.
              </p>
            </div>
            <button
              onClick={runQualityControl}
              disabled={qcBusy}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {qcBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {qcBusy ? "Running…" : "Run quality control"}
            </button>
          </div>
          {qcError && (
            <div className="text-sm text-red-700 font-mono">{qcError}</div>
          )}
          <ResultCard title="Answer-key quality-control results" result={qcResult} />
        </section>

        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl flex items-center gap-2">
                <FileCheck2 className="w-5 h-5" /> Diagnostic 4 — One-paragraph
                maximum answer proof
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Generates a course-length answer of no more than one paragraph for a real course
                problem, visibly writes the complete text below, sends that exact
                text through HTTP, persists and reads it back from the answers
                table, then grades the persisted text with the real course grader.
                The temporary attempt is deleted afterward.
              </p>
            </div>
            <button
              onClick={() => void runLongAnswerDiagnostic()}
              disabled={liveBusy}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {liveBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              {liveBusy ? liveButtonLabel : "Run one-paragraph-maximum proof"}
            </button>
          </div>

          {liveError && (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800"
            >
              <div className="font-semibold">Diagnostic failed visibly</div>
              <div className="font-mono mt-1 break-words">{liveError}</div>
            </div>
          )}

          {liveGenerated && (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <div className="font-serif text-lg">Real seeded course problem</div>
                <div className="text-sm mt-1">{liveGenerated.prompt}</div>
              </div>
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="font-medium text-sm">
                    Exact generated and sent answer
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {liveDisplayedAnswer.length.toLocaleString()} /{" "}
                    {liveGenerated.characterCount.toLocaleString()} characters ·{" "}
                    {liveGenerated.paragraphCount} paragraphs
                  </div>
                </div>
                <div className="min-h-48 whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
                  {liveDisplayedAnswer}
                  {liveStage === "writing" && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-primary animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          )}

          {liveResult && (
            <div
              className={`border rounded-lg overflow-hidden ${
                liveResult.ok
                  ? "border-green-300 bg-green-50/40"
                  : "border-red-300 bg-red-50/40"
              }`}
            >
              <div className="px-5 py-3 border-b border-inherit flex flex-wrap items-center justify-between gap-2">
                <div className="font-serif text-lg">Live proof results</div>
                <div
                  className={`inline-flex items-center gap-2 text-sm font-semibold ${
                    liveResult.ok ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {liveResult.ok ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  {liveResult.ok
                    ? "Complete text persisted exactly"
                    : "Persistence mismatch detected"}
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">
                      Sent characters
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {liveResult.sentCharacterCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">
                      Persisted characters
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {liveResult.persistedCharacterCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">
                      Sent paragraphs
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {liveResult.sentParagraphCount}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-muted-foreground">
                      Persisted paragraphs
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {liveResult.persistedParagraphCount}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border bg-background p-3">
                    <div className="font-medium mb-1">Sent SHA-256</div>
                    <div className="font-mono break-all text-muted-foreground">
                      {liveResult.sentHash}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="font-medium mb-1">Persisted SHA-256</div>
                    <div className="font-mono break-all text-muted-foreground">
                      {liveResult.persistedHash}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-muted-foreground">Exact equality</div>
                    <div className="font-semibold">
                      {liveResult.exactMatch ? "PASS — byte-for-byte match" : "FAIL"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-muted-foreground">Real grader result</div>
                    <div className="font-semibold">
                      {liveResult.gradedCorrect ? "Correct" : "Incorrect"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-muted-foreground">Temporary data cleanup</div>
                    <div className="font-semibold">
                      {liveResult.cleanedUp ? "PASS — deleted" : "FAIL"}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-background p-4">
                  <div className="font-medium text-sm mb-1">
                    Real grader explanation
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {liveResult.gradingExplanation}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-sm mb-2">
                    Exact persisted database answer (read back before grading)
                  </div>
                  <div className="whitespace-pre-wrap break-words rounded-md border bg-background p-4 text-sm leading-relaxed">
                    {liveResult.persistedAnswer}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
