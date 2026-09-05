import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  assignmentsTable,
  problemsTable,
  attemptsTable,
  attemptProblemVariantsTable,
  answersTable,
  topicsTable,
} from "@workspace/db";
import {
  GetAssignmentResponse,
  ListAssignmentsResponse,
  SaveAnswerBody,
  GradeAssignmentAnswerBody,
  GradeAssignmentAnswerResponse,
  StartAssignmentAttemptResponse,
  GetAttemptResponse,
  SubmitAttemptBody,
  SubmitAttemptResponse,
} from "@workspace/api-zod";
import { gradeAnswer, gradePracticeEssay } from "../lib/grading";
import { detect } from "../lib/detection";
import { chatJson } from "../lib/ai";
import {
  questionFormatForOrdinal,
  questionFormatInstruction,
  questionMatchesFormat,
} from "../lib/questionFormats";

const router: IRouter = Router();

function isMultipleChoicePrompt(prompt: string): boolean {
  const labels = [...prompt.matchAll(/(?:^|\s)([A-C])\)\s+/g)].map(
    (match) => match[1],
  );
  return (
    (labels.length === 2 || labels.length === 3) &&
    labels.every((label, index) => label === String.fromCharCode(65 + index)) &&
    !/(?:^|\s)D\)\s+/.test(prompt)
  );
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

async function getAttemptProblems(attemptId: number, assignmentId: number) {
  const sourceProblems = await db
    .select({
      id: problemsTable.id,
      topicId: problemsTable.topicId,
      topicTitle: topicsTable.title,
      position: problemsTable.position,
      prompt: problemsTable.prompt,
      correctAnswer: problemsTable.correctAnswer,
      explanation: problemsTable.explanation,
      hint: problemsTable.hint,
    })
    .from(problemsTable)
    .leftJoin(topicsTable, eq(problemsTable.topicId, topicsTable.id))
    .where(eq(problemsTable.assignmentId, assignmentId))
    .orderBy(asc(problemsTable.position));
  const variants = await db
    .select()
    .from(attemptProblemVariantsTable)
    .where(eq(attemptProblemVariantsTable.attemptId, attemptId))
    .orderBy(asc(attemptProblemVariantsTable.position));
  if (!variants.length) return sourceProblems;

  const topicTitles = new Map(
    sourceProblems.map((problem) => [problem.topicId, problem.topicTitle]),
  );
  return variants.map((variant) => ({
    id: variant.sourceProblemId,
    topicId: variant.topicId,
    topicTitle: topicTitles.get(variant.topicId) ?? null,
    position: variant.position,
    prompt: variant.prompt,
    correctAnswer: variant.correctAnswer,
    explanation: variant.explanation,
    hint: null,
  }));
}

async function generateAttemptProblems(opts: {
  attemptId: number;
  assignment: typeof assignmentsTable.$inferSelect;
}): Promise<void> {
  const existing = await db
    .select({ id: attemptProblemVariantsTable.id })
    .from(attemptProblemVariantsTable)
    .where(eq(attemptProblemVariantsTable.attemptId, opts.attemptId));
  if (existing.length) return;

  const templates = await db
    .select({
      id: problemsTable.id,
      prompt: problemsTable.prompt,
      correctAnswer: problemsTable.correctAnswer,
      topicId: problemsTable.topicId,
      topicTitle: topicsTable.title,
      position: problemsTable.position,
    })
    .from(problemsTable)
    .leftJoin(topicsTable, eq(problemsTable.topicId, topicsTable.id))
    .where(eq(problemsTable.assignmentId, opts.assignment.id))
    .orderBy(asc(problemsTable.position));
  if (!templates.length) throw new Error("assignment has no source problems");

  const [sequence] = await db
    .select({
      maxId: sql<number>`coalesce(max(${attemptProblemVariantsTable.id}), 0)::int`,
    })
    .from(attemptProblemVariantsTable);
  const formats = templates.map((_, index) =>
    questionFormatForOrdinal((sequence?.maxId ?? 0) + index),
  );
  const prior = await db
    .select({ prompt: attemptProblemVariantsTable.prompt })
    .from(attemptProblemVariantsTable)
    .innerJoin(
      problemsTable,
      eq(attemptProblemVariantsTable.sourceProblemId, problemsTable.id),
    )
    .where(eq(problemsTable.assignmentId, opts.assignment.id));
  const excluded = new Set(
    [...templates.map((problem) => problem.prompt), ...prior.map((row) => row.prompt)]
      .map((prompt) => prompt.trim().toLowerCase()),
  );

  for (let generationAttempt = 1; generationAttempt <= 2; generationAttempt += 1) {
    const output = await chatJson<{
      problems: Array<{
        prompt: string;
        correctAnswer: string;
        explanation: string;
      }>;
    }>(
      [
        `Write a completely fresh Nano Evolutionary Psychology ${opts.assignment.kind} question set.`,
        `Return exactly ${templates.length} scenario-reasoning problems in strict JSON as {"problems":[{"prompt":string,"correctAnswer":string,"explanation":string}]}.`,
        "Never reuse, paraphrase, or preserve the named case, setting, surface details, or wording of any source or excluded question.",
        "Every question must require applying a named evolutionary-psychology mechanism or quantitative prediction to a concrete case.",
        "Prioritize kin selection and Hamilton's rule, reciprocal altruism, parental investment, sexual selection, life-history allocation, error-management theory, pathogen avoidance, coalitional psychology, theory of mind, mismatch, and supernormal stimuli.",
        "FORBIDDEN PATTERN: do not make the correct answer merely 'more evidence is needed,' 'consider alternatives,' 'avoid conclusions,' 'the claim is not proven,' or any equivalent generic methodological caution.",
        "Changing names, locations, species, or occupations while preserving the same reasoning structure does not make a question fresh.",
        "Obey each required answer format exactly. Multiple-choice questions must provide exactly two or three options, never four.",
        `Freshness nonce: attempt-${opts.attemptId}-${generationAttempt}.`,
      ].join("\n"),
      JSON.stringify({
        assignmentTitle: opts.assignment.title,
        templates: templates.map((template, index) => ({
          topic: template.topicTitle ?? "evolutionary psychology",
          conceptTarget: template.correctAnswer,
          requiredFormat: questionFormatInstruction(formats[index]!),
        })),
        excludedQuestions: [...excluded].slice(-60),
      }),
    );
    const generated = Array.isArray(output?.problems) ? output.problems : [];
    const valid =
      generated.length === templates.length &&
      generated.every((problem, index) => {
        const prompt = problem?.prompt?.trim() ?? "";
        const correctAnswer = problem?.correctAnswer?.trim() ?? "";
        return (
          prompt.length >= 80 &&
          correctAnswer.length >= 30 &&
          !excluded.has(prompt.toLowerCase()) &&
          !/\b(?:more evidence|consider alternatives|cannot conclude|avoid (?:a )?conclusion|not enough evidence|before (?:concluding|inferring))\b/i.test(
            correctAnswer,
          ) &&
          questionMatchesFormat(prompt, correctAnswer, formats[index]!)
        );
      });
    if (!valid) continue;

    await db.insert(attemptProblemVariantsTable).values(
      generated.map((problem, index) => ({
        attemptId: opts.attemptId,
        sourceProblemId: templates[index]!.id,
        topicId: templates[index]!.topicId,
        position: templates[index]!.position,
        prompt: problem.prompt.trim(),
        correctAnswer: problem.correctAnswer.trim(),
        explanation:
          problem.explanation?.trim() ||
          "Apply the relevant evolutionary-psychology concept to the evidence in the scenario.",
      })),
    );
    return;
  }

  throw new Error("The model did not produce a valid fresh question set.");
}

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
  const problems = await getAttemptProblems(attempt.id, attempt.assignmentId);
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
    problems,
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
    const existingAnswers = await db
      .select({ id: answersTable.id })
      .from(answersTable)
      .where(eq(answersTable.attemptId, existing.id));
    if (!existingAnswers.length) {
      await generateAttemptProblems({ attemptId: existing.id, assignment: a });
    }
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
  try {
    await generateAttemptProblems({ attemptId: created.id, assignment: a });
  } catch (error) {
    await db.delete(attemptsTable).where(eq(attemptsTable.id, created.id));
    res.status(503).json({
      error:
        error instanceof Error
          ? `Could not create a fresh question set: ${error.message}`
          : "Could not create a fresh question set.",
    });
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

router.post(
  "/assignments/attempts/:attemptId/answer/grade",
  async (req, res): Promise<void> => {
    const id = parseIdParam(req.params.attemptId);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = GradeAssignmentAnswerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { problemId, answer, trace, skipDetection } = parsed.data;
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
    const [variant] = await db
      .select()
      .from(attemptProblemVariantsTable)
      .where(
        and(
          eq(attemptProblemVariantsTable.attemptId, id),
          eq(attemptProblemVariantsTable.sourceProblemId, problemId),
        ),
      );
    const prompt = variant?.prompt ?? problem.prompt;
    const correctAnswer = variant?.correctAnswer ?? problem.correctAnswer;
    const explanation = variant?.explanation ?? problem.explanation;
    const multipleChoice = isMultipleChoicePrompt(prompt);
    const grade = multipleChoice
      ? await gradeAnswer({
          prompt,
          correctAnswer,
          userAnswer: answer,
        }).then((result) => ({
          correct: result.correct,
          scorePercent: result.correct ? 100 : 0,
          feedback: result.explanation || explanation,
        }))
      : await gradePracticeEssay({
          prompt,
          correctAnswer,
          userAnswer: answer,
        });

    const [savedAnswer] = await db
      .select()
      .from(answersTable)
      .where(
        and(
          eq(answersTable.attemptId, id),
          eq(answersTable.problemId, problemId),
        ),
      );
    if (savedAnswer) {
      const detection =
        !multipleChoice && !skipDetection && answer.trim()
          ? await detect(answer, {
              keystrokeCount: trace.keystrokeCount,
              eraseCount: trace.eraseCount,
              bulkInsertCount: trace.bulkInsertCount,
              longestBulkInsertChars: trace.longestBulkInsertChars,
              rewriteSegments: trace.rewriteSegments,
              durationMs: trace.durationMs,
            })
          : null;
      await db
        .update(answersTable)
        .set({
          correct: grade.correct,
          scorePercent: Math.round(grade.scorePercent),
          aiScore: detection?.aiScore ?? null,
          aiFlagged: detection?.aiFlagged ?? null,
          diachronicScore: detection?.diachronicScore ?? null,
          diachronicFlagged: detection?.diachronicFlagged ?? null,
          detectionRationale: detection?.rationale ?? null,
        })
        .where(eq(answersTable.id, savedAnswer.id));
    }

    res.json(
      GradeAssignmentAnswerResponse.parse({
        problemId,
        correct: grade.correct,
        scorePercent: Math.round(grade.scorePercent),
        feedback: grade.feedback,
        correctAnswer: grade.correct ? undefined : correctAnswer,
      }),
    );
  },
);

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
  const problems = await getAttemptProblems(id, attempt.assignmentId);

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
    if (!a || a.correct === null) {
      res.status(400).json({
        error: `problem ${p.id} must be graded before finishing the assignment`,
      });
      return;
    }
    const storedScorePercent = a.scorePercent ?? (a.correct ? 100 : 0);
    score += storedScorePercent / 100;
    perProblem.push({
      problemId: p.id,
      correct: a.correct,
      userAnswer,
      correctAnswer: p.correctAnswer,
      explanation: p.explanation,
    });

    if (!multipleChoice && !skipDetection && a.detectionRationale) {
      detection.push({
        problemId: p.id,
        aiScore: a.aiScore,
        aiFlagged: a.aiFlagged,
        diachronicScore: a.diachronicScore,
        diachronicFlagged: a.diachronicFlagged,
        rationale: a.detectionRationale,
      });
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
