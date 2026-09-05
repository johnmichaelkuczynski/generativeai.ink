import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  assignmentsTable,
  problemsTable,
  attemptsTable,
  answersTable,
  topicsTable,
} from "@workspace/db";
import {
  GetAssignmentResponse,
  ListAssignmentsResponse,
  SaveAnswerBody,
  StartAssignmentAttemptResponse,
  GetAttemptResponse,
  SubmitAttemptBody,
  SubmitAttemptResponse,
} from "@workspace/api-zod";
import { gradeAnswer } from "../lib/grading";
import { detect } from "../lib/detection";

const router: IRouter = Router();

function isMultipleChoicePrompt(prompt: string): boolean {
  return /\bA\).+\bB\).+\bC\).+\bD\)/s.test(prompt);
}

type AnswerSnapshot = {
  problemId: number;
  answer: string;
  trace: {
    keystrokeCount: number;
    eraseCount: number;
    bulkInsertCount?: number;
    longestBulkInsertChars?: number;
    rewriteSegments?: number;
    durationMs: number;
  };
};

function parseIdParam(raw: unknown): number {
  const s = Array.isArray(raw) ? raw[0] : (raw as string);
  return parseInt(s ?? "", 10);
}

async function upsertAnswerSnapshot(
  attemptId: number,
  snapshot: AnswerSnapshot,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(answersTable)
    .where(
      and(
        eq(answersTable.attemptId, attemptId),
        eq(answersTable.problemId, snapshot.problemId),
      ),
    );

  const values = {
    attemptId,
    problemId: snapshot.problemId,
    answer: snapshot.answer,
    keystrokeCount: snapshot.trace.keystrokeCount,
    eraseCount: snapshot.trace.eraseCount,
    bulkInsertCount: snapshot.trace.bulkInsertCount ?? 0,
    longestBulkInsertChars: snapshot.trace.longestBulkInsertChars ?? 0,
    rewriteSegments: snapshot.trace.rewriteSegments ?? 0,
    durationMs: snapshot.trace.durationMs,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(answersTable)
      .set(values)
      .where(eq(answersTable.id, existing.id));
  } else {
    await db.insert(answersTable).values(values);
  }
}

router.get("/assignments", async (_req, res) => {
  const rows = await db
    .select()
    .from(assignmentsTable)
    .orderBy(asc(assignmentsTable.weekNumber), asc(assignmentsTable.position));
  const result = await Promise.all(
    rows.map(async (a) => {
      const counts = await db.execute(
        sql`select count(*)::int as n from problems where assignment_id = ${a.id}`,
      );
      const n = (counts.rows[0] as { n?: number } | undefined)?.n ?? 0;
      const attempts = await db
        .select()
        .from(attemptsTable)
        .where(eq(attemptsTable.assignmentId, a.id))
        .orderBy(asc(attemptsTable.id));
      const submitted = attempts.filter((x) => x.status === "submitted");
      const inProgress = attempts.find((x) => x.status === "in_progress");
      const best = submitted.reduce(
        (b, x) => (x.scorePercent != null && x.scorePercent > b ? x.scorePercent : b),
        -1,
      );
      const status: "not_started" | "in_progress" | "submitted" = inProgress
        ? "in_progress"
        : submitted.length > 0
        ? "submitted"
        : "not_started";
      const last = attempts[attempts.length - 1];
      return {
        id: a.id,
        kind: a.kind as "homework" | "test" | "midterm" | "final",
        title: a.title,
        weekNumber: a.weekNumber,
        problemCount: n,
        isTimed: a.isTimed,
        timeLimitMinutes: a.timeLimitMinutes,
        status,
        bestScore: best < 0 ? null : best,
        lastAttemptId: last?.id ?? null,
      };
    }),
  );
  res.json(ListAssignmentsResponse.parse(result));
});

router.get("/assignments/:assignmentId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.assignmentId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const [a] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id));
  if (!a) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const problems = await db
    .select({
      id: problemsTable.id,
      position: problemsTable.position,
      prompt: problemsTable.prompt,
      topicId: problemsTable.topicId,
      topicTitle: topicsTable.title,
      hint: problemsTable.hint,
    })
    .from(problemsTable)
    .leftJoin(topicsTable, eq(problemsTable.topicId, topicsTable.id))
    .where(eq(problemsTable.assignmentId, id))
    .orderBy(asc(problemsTable.position));
  res.json(
    GetAssignmentResponse.parse({
      id: a.id,
      kind: a.kind as "homework" | "test" | "midterm" | "final",
      title: a.title,
      weekNumber: a.weekNumber,
      isTimed: a.isTimed,
      timeLimitMinutes: a.timeLimitMinutes,
      instructions: a.instructions,
      problems,
    }),
  );
});

async function loadAttempt(attemptId: number) {
  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, attemptId));
  if (!attempt) return null;
  const answers = await db
    .select()
    .from(answersTable)
    .where(eq(answersTable.attemptId, attemptId));
  return {
    id: attempt.id,
    assignmentId: attempt.assignmentId,
    status: attempt.status as "in_progress" | "submitted",
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    answers: answers.map((x) => ({
      problemId: x.problemId,
      answer: x.answer,
      keystrokeCount: x.keystrokeCount,
      eraseCount: x.eraseCount,
    })),
  };
}

router.post("/assignments/:assignmentId/start", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.assignmentId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const [a] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, id));
  if (!a) {
    res.status(404).json({ error: "assignment not found" });
    return;
  }

  // Resume any in-progress attempt
  const [existing] = await db
    .select()
    .from(attemptsTable)
    .where(and(eq(attemptsTable.assignmentId, id), eq(attemptsTable.status, "in_progress")));
  if (existing) {
    const state = await loadAttempt(existing.id);
    res.json(StartAssignmentAttemptResponse.parse(state));
    return;
  }

  const deadlineAt =
    a.isTimed && a.timeLimitMinutes
      ? new Date(Date.now() + a.timeLimitMinutes * 60_000)
      : null;
  const [created] = await db
    .insert(attemptsTable)
    .values({ assignmentId: id, status: "in_progress", deadlineAt })
    .returning();
  if (!created) {
    res.status(500).json({ error: "failed to create" });
    return;
  }
  const state = await loadAttempt(created.id);
  res.json(StartAssignmentAttemptResponse.parse(state));
});

router.get("/assignments/attempts/:attemptId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.attemptId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const state = await loadAttempt(id);
  if (!state) {
    res.status(404).json({ error: "attempt not found" });
    return;
  }
  res.json(GetAttemptResponse.parse(state));
});

router.put("/assignments/attempts/:attemptId/answer", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.attemptId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const parsed = SaveAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { problemId, answer, trace } = parsed.data;

  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, id));
  if (!attempt) {
    res.status(404).json({ error: "attempt not found" });
    return;
  }
  if (attempt.status !== "in_progress") {
    res.status(400).json({ error: "attempt already submitted" });
    return;
  }
  if (attempt.deadlineAt && new Date() > attempt.deadlineAt) {
    res.status(403).json({ error: "time limit exceeded" });
    return;
  }

  const [problem] = await db
    .select()
    .from(problemsTable)
    .where(
      and(
        eq(problemsTable.id, problemId),
        eq(problemsTable.assignmentId, attempt.assignmentId),
      ),
    );
  if (!problem) {
    res.status(400).json({ error: "problem does not belong to this attempt" });
    return;
  }

  await upsertAnswerSnapshot(id, { problemId, answer, trace });
  res.json({ ok: true });
});

router.post("/assignments/attempts/:attemptId/submit", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.attemptId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const parsed = SubmitAttemptBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { answers: finalSnapshots, skipDetection } = parsed.data;
  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, id));
  if (!attempt) {
    res.status(404).json({ error: "attempt not found" });
    return;
  }
  if (attempt.status !== "in_progress") {
    res.status(400).json({ error: "attempt already submitted" });
    return;
  }
  if (attempt.deadlineAt && new Date() > attempt.deadlineAt) {
    res.status(403).json({ error: "time limit exceeded" });
    return;
  }
  const problems = await db
    .select()
    .from(problemsTable)
    .where(eq(problemsTable.assignmentId, attempt.assignmentId))
    .orderBy(asc(problemsTable.position));

  if (finalSnapshots) {
    const validProblemIds = new Set(problems.map((problem) => problem.id));
    const submittedProblemIds = new Set<number>();
    for (const snapshot of finalSnapshots) {
      if (!validProblemIds.has(snapshot.problemId)) {
        res.status(400).json({
          error: `problem ${snapshot.problemId} does not belong to this attempt`,
        });
        return;
      }
      if (submittedProblemIds.has(snapshot.problemId)) {
        res.status(400).json({
          error: `problem ${snapshot.problemId} appears more than once`,
        });
        return;
      }
      submittedProblemIds.add(snapshot.problemId);
    }
    if (submittedProblemIds.size !== validProblemIds.size) {
      res.status(400).json({
        error: "final answer snapshot must include every assignment problem",
      });
      return;
    }

    // This request is authoritative: persist the exact final strings carried by
    // submit before loading any rows for grading.
    for (const snapshot of finalSnapshots) {
      await upsertAnswerSnapshot(id, snapshot);
    }
  }

  const answers = await db
    .select()
    .from(answersTable)
    .where(eq(answersTable.attemptId, id));
  const byProblem = new Map(answers.map((a) => [a.problemId, a]));

  const perProblem = [];
  const detection = [];
  let score = 0;
  for (const p of problems) {
    const a = byProblem.get(p.id);
    const userAnswer = a?.answer ?? "";
    const multipleChoice = isMultipleChoicePrompt(p.prompt);
    const graded = await gradeAnswer({
      prompt: p.prompt,
      correctAnswer: p.correctAnswer,
      userAnswer,
    });
    if (graded.correct) score += 1;
    perProblem.push({
      problemId: p.id,
      correct: graded.correct,
      userAnswer,
      correctAnswer: p.correctAnswer,
      explanation: graded.explanation || p.explanation,
    });

    if (
      a &&
      userAnswer.trim().length > 0 &&
      !skipDetection &&
      !multipleChoice
    ) {
      const det = await detect(userAnswer, {
        keystrokeCount: a.keystrokeCount,
        eraseCount: a.eraseCount,
        bulkInsertCount: a.bulkInsertCount,
        longestBulkInsertChars: a.longestBulkInsertChars,
        rewriteSegments: a.rewriteSegments,
        durationMs: a.durationMs,
      });
      detection.push({ problemId: p.id, ...det });
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
        .where(eq(answersTable.id, a.id));
    } else if (a) {
      await db
        .update(answersTable)
        .set({
          correct: graded.correct,
          ...(multipleChoice
            ? {
                aiScore: null,
                aiFlagged: null,
                diachronicScore: null,
                diachronicFlagged: null,
                detectionRationale: null,
              }
            : {}),
        })
        .where(eq(answersTable.id, a.id));
    }
  }

  const total = problems.length;
  const percent = total === 0 ? 0 : (score / total) * 100;
  await db
    .update(attemptsTable)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      scorePercent: percent,
    })
    .where(eq(attemptsTable.id, id));

  res.json(
    SubmitAttemptResponse.parse({
      attemptId: id,
      score,
      total,
      percent,
      perProblem,
      detection,
    }),
  );
});

export default router;
