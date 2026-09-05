import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "wouter";
import { 
  useGetAssignment, 
  useStartAssignmentAttempt, 
  useGetAttempt, 
  useSaveAnswer, 
  useGradeAssignmentAnswer,
  useSubmitAttempt,
  AssignmentAnswerGrade,
  AttemptResult,
  KeystrokeTrace
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnswerInput } from "@/components/AnswerInput";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  MultipleChoiceInput,
  parseMultipleChoicePrompt,
} from "@/components/MultipleChoiceInput";
import { isAdminMode } from "@/lib/adminMode";

export default function AssignmentRunner() {
  const params = useParams();
  const assignmentId = Number(params.id);
  
  const { data: assignment, isLoading: isLoadingAssignment } = useGetAssignment(assignmentId);
  const startAttempt = useStartAssignmentAttempt();
  const submitAttempt = useSubmitAttempt();
  const gradeAssignmentAnswer = useGradeAssignmentAnswer();
  
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const { data: attempt, isError: isAttemptError } = useGetAttempt(attemptId || 0, {
    query: { enabled: !!attemptId, queryKey: ['attempt', attemptId], retry: false }
  });
  
  const saveAnswer = useSaveAnswer();

  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const answersRef = useRef<Record<number, string>>({});
  const tracesRef = useRef<Record<number, KeystrokeTrace>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [gradedAnswers, setGradedAnswers] = useState<
    Record<number, AssignmentAnswerGrade>
  >({});
  const [attemptProblems, setAttemptProblems] = useState<
    NonNullable<typeof assignment>["problems"]
  >([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const activeProblems =
    attemptProblems.length > 0 ? attemptProblems : (assignment?.problems ?? []);

  const emptyTrace = (): KeystrokeTrace => ({
    keystrokeCount: 0,
    eraseCount: 0,
    bulkInsertCount: 0,
    longestBulkInsertChars: 0,
    rewriteSegments: 0,
    durationMs: 0,
  });

  const errorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

  useEffect(() => {
    if (assignmentId && !attemptId && !startAttempt.isPending && !result) {
      startAttempt.mutate({ assignmentId }, {
        onSuccess: (data) => {
          setAttemptId(data.id);
          setAttemptProblems(data.problems);
          const initialAnswers: Record<number, string> = {};
          data.answers.forEach(a => {
            initialAnswers[a.problemId] = a.answer;
            tracesRef.current[a.problemId] = {
              ...emptyTrace(),
              keystrokeCount: a.keystrokeCount ?? 0,
              eraseCount: a.eraseCount ?? 0,
            };
          });
          answersRef.current = initialAnswers;
          setAnswers(initialAnswers);
        }
      });
    }
  }, [assignmentId, attemptId, startAttempt, result]);

  useEffect(() => {
    if (attempt?.problems?.length) setAttemptProblems(attempt.problems);
  }, [attempt?.problems]);

  useEffect(() => {
    if (!attemptId || !isAttemptError) return;
    setAttemptId(null);
    setAttemptProblems([]);
    answersRef.current = {};
    tracesRef.current = {};
    setAnswers({});
    setGradedAnswers({});
    setCurrentProblemIdx(0);
    setActionError(null);
  }, [attemptId, isAttemptError]);

  const handleAnswerChange = (problemId: number, val: string, trace: KeystrokeTrace) => {
    answersRef.current[problemId] = val;
    tracesRef.current[problemId] = trace;
    setAnswers(prev => ({ ...prev, [problemId]: val }));
    setActionError(null);
  };

  const saveProblem = async (problemId: number): Promise<boolean> => {
    if (!attemptId) return false;
    setActionError(null);
    try {
      await saveAnswer.mutateAsync({
        attemptId,
        data: {
          problemId,
          answer: answersRef.current[problemId] ?? "",
          trace: tracesRef.current[problemId] ?? emptyTrace(),
        },
      });
      return true;
    } catch (error) {
      setActionError(`Your answer could not be saved: ${errorMessage(error)}`);
      return false;
    }
  };

  const handleNavigate = async (nextIndex: number) => {
    const currentProblem = activeProblems[currentProblemIdx];
    if (!currentProblem) return;
    const saved = await saveProblem(currentProblem.id);
    if (saved) setCurrentProblemIdx(nextIndex);
  };

  const handleSubmit = async () => {
    if (!attemptId || !assignment) return;
    setActionError(null);
    const finalAnswers = activeProblems.map((problem) => ({
      problemId: problem.id,
      answer: answersRef.current[problem.id] ?? "",
      trace: tracesRef.current[problem.id] ?? emptyTrace(),
    }));
    try {
      const data = await submitAttempt.mutateAsync({
        attemptId,
        data: {
          answers: finalAnswers,
          skipDetection: isAdminMode(),
        },
      });
      setResult(data);
    } catch (error) {
      setActionError(
        `Your complete assignment could not be submitted: ${errorMessage(error)}`,
      );
    }
  };

  const handleGradeCurrent = async () => {
    if (!attemptId || !currentProblem) return;
    const answer = answersRef.current[currentProblem.id] ?? "";
    if (!answer.trim()) {
      setActionError("Select or enter an answer before submitting it.");
      return;
    }
    setActionError(null);
    try {
      const grade = await gradeAssignmentAnswer.mutateAsync({
        attemptId,
        data: {
          problemId: currentProblem.id,
          answer,
          trace: tracesRef.current[currentProblem.id] ?? emptyTrace(),
          skipDetection: isAdminMode(),
        },
      });
      setGradedAnswers((previous) => ({
        ...previous,
        [currentProblem.id]: grade,
      }));
    } catch (error) {
      setActionError(
        `This answer could not be graded: ${errorMessage(error)}`,
      );
    }
  };

  if (isLoadingAssignment || !assignment) {
    return (
      <Layout>
        <div className="p-8 max-w-4xl mx-auto w-full flex flex-col gap-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (result) {
    return (
      <Layout>
        <div className="p-8 max-w-4xl mx-auto w-full flex flex-col gap-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-serif font-bold text-primary mb-2">{assignment.title} - Results</h1>
              <p className="text-muted-foreground">Score: {result.percent}% ({result.score}/{result.total})</p>
            </div>
            <Link href={`/assignments`}>
              <Button variant="outline">Back to Assignments</Button>
            </Link>
          </div>
          
          <div className="flex flex-col gap-6">
            {result.perProblem.map((pr, idx) => (
              <div key={pr.problemId} className={`p-6 rounded-lg border ${pr.correct ? 'border-chart-2/50 bg-chart-2/5' : 'border-destructive/50 bg-destructive/5'}`}>
                <h3 className="font-medium mb-2">Problem {idx + 1}</h3>
                <div className="mb-4">
                  <span className="text-sm font-semibold">Your Answer:</span>
                  <div className="font-mono mt-1 whitespace-pre-wrap break-words">
                    {pr.userAnswer || "No answer"}
                  </div>
                </div>
                {!pr.correct && pr.correctAnswer && (
                  <div className="mb-4 text-primary">
                    <span className="text-sm font-semibold">Correct Answer:</span>
                    <div className="font-mono mt-1">{pr.correctAnswer}</div>
                  </div>
                )}
                <div>
                  <span className="text-sm font-semibold">Explanation:</span>
                  <div className="mt-1 text-sm"><MarkdownRenderer content={pr.explanation} /></div>
                </div>
                
                {/* AI Flags */}
                {result.detection.find(d => d.problemId === pr.problemId)?.aiFlagged && (
                  <div className="mt-4 p-3 bg-secondary rounded-md text-sm border border-secondary-border">
                    <strong className="text-chart-4">Flagged content accepted — no penalty during initial phase.</strong>
                    <p className="text-muted-foreground mt-1">{result.detection.find(d => d.problemId === pr.problemId)?.rationale}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const currentProblem = activeProblems[currentProblemIdx];
  const multipleChoice = currentProblem
    ? parseMultipleChoicePrompt(currentProblem.prompt)
    : null;
  const currentGrade = currentProblem
    ? gradedAnswers[currentProblem.id]
    : undefined;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto w-full flex flex-col gap-6 pb-24">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground">Problem {currentProblemIdx + 1} of {activeProblems.length}</p>
          </div>
          {attempt?.deadlineAt && (
            <div className="text-destructive font-mono font-bold px-3 py-1 rounded bg-destructive/10 border border-destructive/20">
              Deadline: {new Date(attempt.deadlineAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-chart-2/40 bg-chart-2/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-foreground">
            <strong>This is the graded {assignment.kind} — the tutor is off and your work is scored.</strong>{" "}
            Want to warm up first? Run an unlimited practice version that gives
            feedback and keeps the tutor with you.
          </div>
          <Link href={`/assignments/${assignmentId}/practice`}>
            <Button variant="outline" className="shrink-0">
              ✨ Practice this first
            </Button>
          </Link>
        </div>

        {currentProblem ? (
          <div className="flex flex-col gap-8">
            <div className="prose prose-slate dark:prose-invert max-w-none text-lg">
              <MarkdownRenderer
                content={multipleChoice?.stem ?? currentProblem.prompt}
              />
            </div>
            
            <div className="flex flex-col gap-4">
              {multipleChoice ? (
                <MultipleChoiceInput
                  key={currentProblem.id}
                  options={multipleChoice.options}
                  value={answers[currentProblem.id] || ""}
                  name={`assignment-problem-${currentProblem.id}`}
                  disabled={!!currentGrade}
                  onChange={(val, trace) =>
                    handleAnswerChange(currentProblem.id, val, trace)
                  }
                />
              ) : (
                <AnswerInput
                  key={currentProblem.id}
                  value={answers[currentProblem.id] || ""}
                  onChange={(val, trace) =>
                    handleAnswerChange(currentProblem.id, val, trace)
                  }
                  initialTrace={tracesRef.current[currentProblem.id]}
                  disabled={!!currentGrade}
                  compact={/(answer in one sentence|answer in 1[–-]3 sentences)/i.test(
                    currentProblem.prompt,
                  )}
                />
              )}
            </div>

            {currentGrade && (
              <div
                className={`rounded-lg border p-5 ${
                  currentGrade.correct
                    ? "border-green-300 bg-green-50/60"
                    : "border-amber-300 bg-amber-50/60"
                }`}
                data-testid={`result-assignment-answer-${currentProblem.id}`}
              >
                <div
                  className="text-2xl font-bold tabular-nums"
                  data-testid={`text-assignment-score-${currentProblem.id}`}
                >
                  {Math.round(currentGrade.scorePercent)}%
                </div>
                <div className="mt-2 text-sm">
                  <MarkdownRenderer content={currentGrade.feedback} />
                </div>
                {!currentGrade.correct && currentGrade.correctAnswer && (
                  <div className="mt-3 border-t border-amber-300 pt-3 text-sm">
                    <span className="font-semibold">Model answer:</span>{" "}
                    {currentGrade.correctAnswer}
                  </div>
                )}
              </div>
            )}

            {actionError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {actionError}
              </div>
            )}

            <div className="flex justify-between mt-8 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => void handleNavigate(Math.max(0, currentProblemIdx - 1))}
                disabled={
                  currentProblemIdx === 0 ||
                  saveAnswer.isPending ||
                  gradeAssignmentAnswer.isPending ||
                  submitAttempt.isPending
                }
              >
                {saveAnswer.isPending ? "Saving..." : "Previous"}
              </Button>
              
              {!currentGrade ? (
                <Button
                  onClick={() => void handleGradeCurrent()}
                  disabled={
                    !answers[currentProblem.id]?.trim() ||
                    gradeAssignmentAnswer.isPending ||
                    saveAnswer.isPending
                  }
                  data-testid={`button-submit-answer-${currentProblem.id}`}
                >
                  {gradeAssignmentAnswer.isPending
                    ? "Grading…"
                    : "Submit answer"}
                </Button>
              ) : currentProblemIdx < activeProblems.length - 1 ? (
                <Button 
                  onClick={() =>
                    setCurrentProblemIdx(
                      Math.min(activeProblems.length - 1, currentProblemIdx + 1),
                    )
                  }
                  disabled={gradeAssignmentAnswer.isPending || submitAttempt.isPending}
                  data-testid="button-next-problem"
                >
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={() => void handleSubmit()}
                  className="bg-chart-2 hover:bg-chart-2/90 text-white"
                  disabled={
                    saveAnswer.isPending ||
                    gradeAssignmentAnswer.isPending ||
                    submitAttempt.isPending ||
                    Object.keys(gradedAnswers).length !== activeProblems.length
                  }
                  data-testid="button-finish-assignment"
                >
                  {submitAttempt.isPending ? "Finishing..." : "Finish Assignment"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div>Problem not found.</div>
        )}
      </div>
    </Layout>
  );
}
