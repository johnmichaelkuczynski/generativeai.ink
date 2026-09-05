import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  topicsTable,
  practiceSessionsTable,
  practiceProblemsTable,
  practiceAttemptsTable,
} from "@workspace/db";
import {
  StartPracticeSessionBody,
  StartPracticeSessionResponse,
  NextPracticeProblemBody,
  NextPracticeProblemResponse,
  GradePracticeAnswerBody,
  GradePracticeAnswerResponse,
} from "@workspace/api-zod";
import { chatJson } from "../lib/ai";
import { gradeAnswer } from "../lib/grading";
import {
  fallbackQuestion,
  questionMatchesFormat,
  questionFormatForOrdinal,
  questionFormatInstruction,
} from "../lib/questionFormats";

const router: IRouter = Router();

function parseIdParam(raw: unknown): number {
  const s = Array.isArray(raw) ? raw[0] : (raw as string);
  return parseInt(s ?? "", 10);
}

function isValidReasoningProblem(problem: {
  prompt: string;
  correctAnswer: string;
  explanation: string;
}, format: ReturnType<typeof questionFormatForOrdinal>): boolean {
  const prompt = problem.prompt.trim();
  const answer = problem.correctAnswer.trim();
  const sentenceCount = answer.split(/[.!?]+(?:\s|$)/).filter(Boolean).length;
  return (
    prompt.length >= 80 &&
    answer.length >= 60 &&
    sentenceCount >= 1 &&
    questionMatchesFormat(prompt, answer, format) &&
    !/\b(define|what (?:is|are) .+ called|what does .+ mean|difference between)\b/i.test(
      prompt,
    )
  );
}

async function pickTopicId(
  weekNumber: number | null | undefined,
  preferred: number | null | undefined,
  focusOnWeaknesses: boolean,
): Promise<{ id: number; title: string; weekNumber: number }> {
  if (preferred != null) {
    const [t] = await db.select().from(topicsTable).where(eq(topicsTable.id, preferred));
    if (t) return { id: t.id, title: t.title, weekNumber: t.weekNumber };
  }
  const candidates = weekNumber
    ? await db.select().from(topicsTable).where(eq(topicsTable.weekNumber, weekNumber))
    : await db.select().from(topicsTable);

  if (focusOnWeaknesses) {
    const stats = await db.execute(sql`
      select topic_id, count(*)::int as n, avg(case when correct then 1.0 else 0.0 end) as acc
      from practice_attempts group by topic_id
    `);
    const byId = new Map<number, { n: number; acc: number }>();
    for (const r of stats.rows as Array<{ topic_id: number; n: number; acc: number }>) {
      byId.set(Number(r.topic_id), { n: Number(r.n), acc: Number(r.acc) });
    }
    // weight = (1 - accuracy) + small bonus for low-attempted topics
    const scored = candidates.map((t) => {
      const s = byId.get(t.id);
      const acc = s?.acc ?? 0.5;
      const n = s?.n ?? 0;
      const weight = (1 - acc) * 2 + (n < 3 ? 1 : 0) + Math.random() * 0.3;
      return { t, weight };
    });
    scored.sort((a, b) => b.weight - a.weight);
    const choice = scored[0]?.t ?? candidates[Math.floor(Math.random() * candidates.length)]!;
    return { id: choice.id, title: choice.title, weekNumber: choice.weekNumber };
  }
  const choice = candidates[Math.floor(Math.random() * candidates.length)]!;
  return { id: choice.id, title: choice.title, weekNumber: choice.weekNumber };
}

router.post("/practice/sessions", async (req, res): Promise<void> => {
  const parsed = StartPracticeSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { weekNumber, topicId, tutorEnabled, focusOnWeaknesses, initialDifficulty } =
    parsed.data;
  const startDifficulty =
    typeof initialDifficulty === "number" && !Number.isNaN(initialDifficulty)
      ? Math.max(1, Math.min(5, initialDifficulty))
      : 2.0;
  const [created] = await db
    .insert(practiceSessionsTable)
    .values({
      weekNumber: weekNumber ?? null,
      topicId: topicId ?? null,
      tutorEnabled,
      focusOnWeaknesses: focusOnWeaknesses ?? true,
      difficulty: startDifficulty,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "failed" });
    return;
  }
  res.json(
    StartPracticeSessionResponse.parse({
      id: created.id,
      tutorEnabled: created.tutorEnabled,
      difficulty: created.difficulty,
      weekNumber: created.weekNumber,
      topicId: created.topicId,
      focusOnWeaknesses: created.focusOnWeaknesses,
    }),
  );
});

router.post("/practice/sessions/:sessionId/next", async (req, res): Promise<void> => {
  const sessionId = parseIdParam(req.params.sessionId);
  const parsed = NextPracticeProblemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(eq(practiceSessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  const topic = await pickTopicId(
    session.weekNumber,
    parsed.data.topicId ?? session.topicId,
    session.focusOnWeaknesses,
  );

  const lastProblems = await db
    .select({ prompt: practiceProblemsTable.prompt })
    .from(practiceProblemsTable)
    .where(
      and(
        eq(practiceProblemsTable.sessionId, sessionId),
        eq(practiceProblemsTable.topicId, topic.id),
      ),
    )
    .orderBy(desc(practiceProblemsTable.id))
    .limit(3);

  const difficulty = Math.max(1, Math.min(5, session.difficulty));
  const difficultyLabel =
    difficulty <= 1.7
      ? "very easy"
      : difficulty <= 2.5
      ? "easy"
      : difficulty <= 3.3
      ? "medium"
      : difficulty <= 4.1
      ? "hard"
      : "challenging";

  const userRequest = parsed.data.request?.trim() || "";
  const [sequence] = await db
    .select({
      maxId: sql<number>`coalesce(max(${practiceProblemsTable.id}), 0)::int`,
    })
    .from(practiceProblemsTable);
  const requiredFormat = questionFormatForOrdinal(sequence?.maxId ?? 0);
  const formatInstruction = questionFormatInstruction(requiredFormat);
  let generated: { prompt: string; correctAnswer: string; explanation: string };
  try {
    generated = await chatJson<{
      prompt: string;
      correctAnswer: string;
      explanation: string;
    }>(
      `You generate a single practice problem for Nano Evolutionary Psychology. The problem MUST be on the topic "${topic.title}" and at difficulty "${difficultyLabel}" (${difficulty.toFixed(
        1,
      )}/5). Test applied scientific reasoning, not recall. The question MUST be fully self-contained.\n\nREQUIRED FORMAT:\n${formatInstruction}\n\nThe rolling bank uses exactly 60% multiple choice, 30% one-sentence answers, 8% 1–3 sentence answers, and 2% one-paragraph answers of 5–7 sentences.\n\nSTRICT QUESTION RULES:\n- Present a specific named behavioral, developmental, or research scenario and ask the student to evaluate an evolutionary hypothesis against evidence and alternatives.\n- Never ask for a definition, terminology recall, or bare yes/no.\n- Distinguish hypotheses from evidence; never imply genetic determinism, universality from an average, or moral justification from evolutionary origins.\n- The explanation briefly says what earns full credit.\n\nRespond as strict JSON: {"prompt": string, "correctAnswer": string, "explanation": string}. Avoid these recent prompts: ${JSON.stringify(
        lastProblems.map((p) => p.prompt),
      )}.`,
      userRequest || `Generate a new ${difficultyLabel} problem on ${topic.title}.`,
    );
    if (!isValidReasoningProblem(generated, requiredFormat)) {
      throw new Error("generated problem did not meet scenario-reasoning requirements");
    }
  } catch {
    generated = fallbackQuestion(requiredFormat, topic.title);
  }

  const [stored] = await db
    .insert(practiceProblemsTable)
    .values({
      sessionId,
      topicId: topic.id,
      prompt: generated.prompt,
      correctAnswer: generated.correctAnswer,
      explanation: generated.explanation,
      difficulty,
    })
    .returning();
  if (!stored) {
    res.status(500).json({ error: "failed" });
    return;
  }

  res.json(
    NextPracticeProblemResponse.parse({
      id: stored.id,
      prompt: stored.prompt,
      topicId: topic.id,
      topicTitle: topic.title,
      difficulty,
    }),
  );
});

router.post("/practice/sessions/:sessionId/grade", async (req, res): Promise<void> => {
  const sessionId = parseIdParam(req.params.sessionId);
  const parsed = GradePracticeAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { problemId, answer, trace } = parsed.data;
  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(eq(practiceSessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  const [problem] = await db
    .select()
    .from(practiceProblemsTable)
    .where(
      and(
        eq(practiceProblemsTable.id, problemId),
        eq(practiceProblemsTable.sessionId, sessionId),
      ),
    );
  if (!problem) {
    res.status(404).json({ error: "problem not found in this session" });
    return;
  }

  const graded = await gradeAnswer({
    prompt: problem.prompt,
    correctAnswer: problem.correctAnswer,
    userAnswer: answer,
  });

  await db.insert(practiceAttemptsTable).values({
    sessionId,
    problemId,
    topicId: problem.topicId,
    answer,
    correct: graded.correct,
    difficulty: problem.difficulty,
    trace,
  });

  const delta = graded.correct ? 0.4 : -0.5;
  const newDifficulty = Math.max(1, Math.min(5, session.difficulty + delta));
  await db
    .update(practiceSessionsTable)
    .set({ difficulty: newDifficulty })
    .where(eq(practiceSessionsTable.id, sessionId));

  let tutorTip: string | null = null;
  if (session.tutorEnabled && !graded.correct) {
    try {
      tutorTip = (
        await chatJson<{ tip: string }>(
          "You are a kind, concise Evolutionary Psychology tutor. Given a problem, the correct answer, and the student's wrong attempt, give ONE focused next-step tip (2 sentences max), emphasizing evidence and cautious inference. Respond as strict JSON: {\"tip\": string}.",
          JSON.stringify({
            prompt: problem.prompt,
            correctAnswer: problem.correctAnswer,
            studentAnswer: answer,
          }),
        )
      ).tip;
    } catch {
      tutorTip = null;
    }
  }

  res.json(
    GradePracticeAnswerResponse.parse({
      problemId,
      correct: graded.correct,
      correctAnswer: problem.correctAnswer,
      explanation: graded.explanation || problem.explanation,
      newDifficulty,
      tutorTip,
    }),
  );
});

export default router;
