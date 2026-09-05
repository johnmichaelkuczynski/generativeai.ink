import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGeneratePracticeAssignment,
  useGradePracticeAssignment,
  useAskTutor,
  type PracticeAssignmentSet,
  type PracticeAssignmentResult,
  type KeystrokeTrace,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnswerInput } from "@/components/AnswerInput";
import {
  MultipleChoiceInput,
  parseMultipleChoicePrompt,
} from "@/components/MultipleChoiceInput";
import { MathKeyboard, insertAtTextareaCursor } from "@/components/MathKeyboard";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Send,
  GraduationCap,
} from "lucide-react";

type ChatMsg = { role: "user" | "tutor"; text: string };

export default function PracticeAssignment() {
  const params = useParams();
  const assignmentId = Number(params.id);

  const generate = useGeneratePracticeAssignment();
  const grader = useGradePracticeAssignment();

  const [set, setSet] = useState<PracticeAssignmentSet | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [traces, setTraces] = useState<Record<number, KeystrokeTrace>>({});
  const [results, setResults] = useState<PracticeAssignmentResult[] | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  // Lifted tutor state so per-problem "Discuss this feedback" buttons can seed
  // the conversation while the tutor stays on-screen the whole time.
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const ask = useAskTutor();

  function newSet() {
    setResults(null);
    setPercent(null);
    setAnswers({});
    setTraces({});
    setSet(null);
    generate.mutate(
      { assignmentId },
      { onSuccess: (data) => setSet(data) },
    );
  }

  useEffect(() => {
    if (!Number.isFinite(assignmentId)) return;
    newSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function submitForFeedback() {
    if (!set) return;
    const payload = set.problems.map((p) => ({
      problemId: p.id,
      answer: answers[p.id] ?? "",
      trace: traces[p.id],
    }));
    grader.mutate(
      { sessionId: set.sessionId, data: { answers: payload } },
      {
        onSuccess: (data) => {
          setResults(data.results);
          setPercent(data.percent);
        },
      },
    );
  }

  function sendToTutor(message: string, displayOverride?: string) {
    const text = message.trim();
    if (!text) return;
    const shown = (displayOverride ?? message).trim();
    setHistory((h) => [...h, { role: "user", text: shown }]);
    ask.mutate(
      { data: { message: text } },
      {
        onSuccess: (res) =>
          setHistory((h) => [...h, { role: "tutor", text: res.text }]),
        onError: (e) =>
          setHistory((h) => [
            ...h,
            { role: "tutor", text: `Tutor error: ${(e as Error).message}` },
          ]),
      },
    );
  }

  function discussFeedback(r: PracticeAssignmentResult) {
    // Hidden context for the tutor; the student sees a natural question.
    const backendMessage =
      `The student wants to discuss feedback on this practice problem.\n\n` +
      `PROBLEM: ${r.prompt}\n\n` +
      `THEIR ANSWER: ${r.userAnswer || "(left blank)"}\n\n` +
      `MODEL ANSWER: ${r.correctAnswer}\n\n` +
      `FEEDBACK THEY GOT: ${r.feedback}\n\n` +
      `Walk them through what they missed and how to think about it, then check their understanding with a follow-up question.`;
    sendToTutor(backendMessage, "Can you walk me through what I missed on this one?");
  }

  const resultById = new Map((results ?? []).map((r) => [r.problemId, r]));

  return (
    <Layout>
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <Link href="/assignments">
          <Button
            variant="ghost"
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assignments
          </Button>
        </Link>
        {set && (
          <Link href={`/assignments/${assignmentId}`}>
            <Button variant="outline" size="sm">
              <GraduationCap className="w-4 h-4 mr-2" />
              Take the graded {set.kind}
            </Button>
          </Link>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
        {/* LEFT: practice problems + feedback */}
        <div className="overflow-y-auto px-6 lg:px-8 pb-16 border-r border-border">
          <div className="mt-2 mb-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-chart-2 mb-2">
              <Sparkles className="w-4 h-4" />
              Practice {set?.kind ?? "assignment"} · never graded
            </div>
            <h1 className="text-2xl font-serif font-bold text-primary leading-tight">
              {set?.title ?? "Generating your practice set…"}
            </h1>
            <div className="mt-3 rounded-lg border border-chart-2/40 bg-chart-2/5 p-3 text-sm text-foreground">
              Drill this as many times as you want — every set is brand new.
              Submit for detailed feedback, then talk it through with the tutor on
              the right. <strong>Practice here until you're confident before you
              take the real graded {set?.kind ?? "assignment"}.</strong>
            </div>
          </div>

          {generate.isPending || !set ? (
            <div className="flex flex-col gap-4 mt-6">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {set.instructions && (
                <div className="text-sm text-muted-foreground italic">
                  <MarkdownRenderer content={set.instructions} />
                </div>
              )}

              {set.problems.map((p, idx) => {
                const r = resultById.get(p.id);
                const multipleChoice = parseMultipleChoicePrompt(p.prompt);
                return (
                  <div
                    key={p.id}
                    className="bg-card border rounded-lg p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        Problem {idx + 1}
                        {p.topicTitle && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground uppercase tracking-wider">
                            {p.topicTitle}
                          </span>
                        )}
                      </h3>
                      {r && (
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium ${
                            r.correct ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {r.correct ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {r.correct ? "On track" : "Needs work"}
                        </span>
                      )}
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      <MarkdownRenderer content={multipleChoice?.stem ?? p.prompt} />
                    </div>

                    {multipleChoice ? (
                      <MultipleChoiceInput
                        options={multipleChoice.options}
                        value={answers[p.id] ?? ""}
                        onChange={(val, trace) => {
                          setAnswers((prev) => ({ ...prev, [p.id]: val }));
                          setTraces((prev) => ({ ...prev, [p.id]: trace }));
                        }}
                        disabled={!!results}
                      />
                    ) : (
                      <AnswerInput
                        value={answers[p.id] ?? ""}
                        onChange={(val, trace) => {
                          setAnswers((prev) => ({ ...prev, [p.id]: val }));
                          setTraces((prev) => ({ ...prev, [p.id]: trace }));
                        }}
                        disabled={!!results}
                      />
                    )}

                    {r && (
                      <div
                        className={`rounded-md border p-4 ${
                          r.correct
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-amber-50 border-amber-300"
                        }`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Feedback
                        </div>
                        <div className="text-sm prose prose-sm max-w-none">
                          <MarkdownRenderer content={r.feedback} />
                        </div>
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Show model answer
                          </summary>
                          <div className="mt-2 prose prose-sm max-w-none">
                            <MarkdownRenderer content={r.correctAnswer} />
                          </div>
                        </details>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => discussFeedback(r)}
                            disabled={ask.isPending}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Discuss this feedback with the tutor
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-8">
                <Button
                  variant="outline"
                  onClick={newSet}
                  disabled={generate.isPending}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate another practice set
                </Button>

                {!results ? (
                  <Button
                    onClick={submitForFeedback}
                    disabled={grader.isPending}
                    className="bg-chart-2 hover:bg-chart-2/90 text-white"
                  >
                    {grader.isPending ? "Getting feedback…" : "Submit for feedback"}
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Practice score:{" "}
                      <strong className="text-foreground">{percent}%</strong>{" "}
                      (not graded)
                    </span>
                    <Button onClick={newSet} disabled={generate.isPending}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Practice again
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: live tutor — always on-screen during practice */}
        <TutorPane
          history={history}
          pending={ask.isPending}
          onSend={sendToTutor}
        />
      </div>
    </Layout>
  );
}

function TutorPane({
  history,
  pending,
  onSend,
}: {
  history: ChatMsg[];
  pending: boolean;
  onSend: (msg: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [history.length, pending]);

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

  function send() {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    onSend(msg);
  }

  return (
    <div className="flex flex-col min-h-0 bg-secondary/20">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2.5">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Live tutor</span>
        <span className="text-xs text-muted-foreground">
          here the whole time you practice
        </span>
      </div>

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
            placeholder="Ask the tutor anything about these problems or your feedback… (Shift+Enter for newline)"
            rows={4}
            className="flex-1 bg-secondary border-none rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[96px] max-h-[280px]"
          />
          <Button size="lg" onClick={send} disabled={!input.trim() || pending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <MathKeyboard onInsert={handleMathInsert} />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
      >
        {history.length === 0 && (
          <div className="m-auto text-center text-sm text-muted-foreground italic max-w-sm">
            Work the practice problems on the left, submit for feedback, then hit
            "Discuss this feedback with the tutor" — or just ask anything here.
            The tutor stays with you through every practice round.
          </div>
        )}

        {history.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] ${
              m.role === "user" ? "self-end" : "self-start"
            }`}
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
        {pending && (
          <div className="self-start px-3 py-2 rounded-lg bg-card border border-border text-sm animate-pulse text-muted-foreground">
            Thinking…
          </div>
        )}
      </div>
    </div>
  );
}
