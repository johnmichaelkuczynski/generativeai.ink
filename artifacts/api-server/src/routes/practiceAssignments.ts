import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  assignmentsTable,
  problemsTable,
  topicsTable,
  lecturesTable,
  practiceSessionsTable,
  practiceProblemsTable,
  practiceAttemptsTable,
} from "@workspace/db";
import {
  GeneratePracticeAssignmentResponse,
  GradePracticeAssignmentBody,
  GradePracticeAssignmentResponse,
} from "@workspace/api-zod";
import { chatJson } from "../lib/ai";
import {
  gradePracticeEssay,
  gradeRecoveredPracticeEssay,
} from "../lib/grading";
import {
  type QuestionFormat,
  questionMatchesFormat,
  questionFormatForOrdinal,
  questionFormatInstruction,
  rewriteFormalPrincipleNames,
  usesFormalPrincipleName,
} from "../lib/questionFormats";

const router: IRouter = Router();

function parseIdParam(raw: unknown): number {
  const s = Array.isArray(raw) ? raw[0] : (raw as string);
  return parseInt(s ?? "", 10);
}

function isValidReasoningProblem(problem: {
  prompt: string;
  correctAnswer: string;
}, format: QuestionFormat): boolean {
  const prompt = problem.prompt.trim();
  const answer = problem.correctAnswer.trim();
  return (
    prompt.length >= 80 &&
    answer.length >= 30 &&
    questionMatchesFormat(prompt, answer, format) &&
    !/\b(define|what (?:is|are) .+ called|what does .+ mean|difference between)\b/i.test(
      prompt,
    )
  );
}

// Generate a fresh, never-graded PRACTICE version of a graded assignment.
// Each call produces a brand-new set of problems modeled on the source
// assignment (same topics, same kind, same reasoning-answer format) — so the
// student can drill infinitely many practice homeworks / tests / midterms /
// finals before sitting the real one.
router.post(
  "/assignments/:assignmentId/practice",
  async (req, res): Promise<void> => {
    const assignmentId = parseIdParam(req.params.assignmentId);
    if (!Number.isFinite(assignmentId)) {
      res.status(400).json({ error: "invalid assignmentId" });
      return;
    }

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId));
    if (!assignment) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }

    const sourceProblems = await db
      .select({
        prompt: problemsTable.prompt,
        correctAnswer: problemsTable.correctAnswer,
        topicId: problemsTable.topicId,
        topicTitle: topicsTable.title,
        reading: lecturesTable.body,
        position: problemsTable.position,
      })
      .from(problemsTable)
      .leftJoin(topicsTable, eq(problemsTable.topicId, topicsTable.id))
      .leftJoin(lecturesTable, eq(problemsTable.topicId, lecturesTable.topicId))
      .where(eq(problemsTable.assignmentId, assignmentId))
      .orderBy(asc(problemsTable.position));

    if (sourceProblems.length === 0) {
      res.status(404).json({ error: "assignment has no problems" });
      return;
    }

    // Cap how many we generate per set to keep generation snappy; mirror the
    // real assignment's length up to the cap.
    const templates = sourceProblems.slice(0, 10);
    const [sequence] = await db
      .select({
        maxId: sql<number>`coalesce(max(${practiceProblemsTable.id}), 0)::int`,
      })
      .from(practiceProblemsTable);
    const formats = templates.map((_, index) =>
      questionFormatForOrdinal((sequence?.maxId ?? 0) + index),
    );

    type GeneratedPracticeProblem = {
      prompt: string;
      correctAnswer: string;
      explanation: string;
      readingSupportQuote: string;
    };
    const generatedProblemsAreValid = (
      candidate: GeneratedPracticeProblem[],
    ): boolean =>
      candidate.length === templates.length &&
      templates.every((_, i) => {
        const g = candidate[i];
        const reading = templates[i]?.reading ?? "";
        const quote = g?.readingSupportQuote?.trim() ?? "";
        return Boolean(
          g &&
            typeof g.prompt === "string" &&
            g.prompt.trim() &&
            typeof g.correctAnswer === "string" &&
            g.correctAnswer.trim() &&
            quote.split(/\s+/).length >= 5 &&
            reading
              .replace(/\s+/g, " ")
              .toLowerCase()
              .includes(quote.replace(/\s+/g, " ").toLowerCase()) &&
            !usesFormalPrincipleName(g.prompt) &&
            isValidReasoningProblem(g, formats[i]!) &&
            !/\b(?:more evidence|consider alternatives|cannot conclude|avoid (?:a )?conclusion|not enough evidence|before (?:concluding|inferring))\b/i.test(
              g.correctAnswer,
            ),
        );
      });

    const generateOnce = async (): Promise<GeneratedPracticeProblem[]> => {
      const out = await chatJson<{
        problems: GeneratedPracticeProblem[];
      }>(
        `You write a PRACTICE version of a Nano Evolutionary Psychology ${assignment.kind} titled "${assignment.title}". Produce EXACTLY ${templates.length} genuinely new scenario problems, one per supplied reading in order. Every problem must be fully answerable from that reading alone. Test application of a principle in ordinary language, not recall of its label. Avoid formal principle names in prompts and options. If a formal name is genuinely unavoidable, define the complete principle immediately in that same question so recognizing the label is never required. Never ask the learner to identify or supply a principle's name. State every extra number or relationship needed in the problem. readingSupportQuote must be an exact contiguous quote of at least five words from the reading that establishes the answer. FORBIDDEN: a correct answer that merely says more evidence is needed, alternatives should be considered, certainty is unwarranted, or conclusions should be avoided. Changing only names or surface details is not fresh. Require reasoning, not definitions. Obey each requiredFormat exactly. Across the rolling question bank the formats are fixed at 60% multiple choice, 30% one-sentence, 8% 1–3 sentences, and 2% one paragraph of 5–7 sentences. Respond as strict JSON: {"problems": [{"prompt": string, "correctAnswer": string, "explanation": string, "readingSupportQuote": string}, ...]}.`,
        JSON.stringify({
          assignmentKind: assignment.kind,
          assignmentTitle: assignment.title,
          templates: templates.map((t, i) => ({
            number: i + 1,
            topic: t.topicTitle ?? "evolutionary psychology",
            assignedReading: t.reading,
            requiredFormat: questionFormatInstruction(formats[i]!),
          })),
        }),
      );
      return (Array.isArray(out?.problems) ? out.problems : []).map(
        (problem) => ({
          ...problem,
          prompt: rewriteFormalPrincipleNames(problem.prompt ?? ""),
          correctAnswer: rewriteFormalPrincipleNames(problem.correctAnswer ?? ""),
          explanation: rewriteFormalPrincipleNames(problem.explanation ?? ""),
        }),
      );
    };

    let generated: GeneratedPracticeProblem[] = [];
    for (let generationAttempt = 1; generationAttempt <= 5; generationAttempt += 1) {
      try {
        generated = await generateOnce();
      } catch {
        generated = [];
      }
      if (generatedProblemsAreValid(generated)) break;
    }

    const allGeneratedProblemsAreValid =
      generatedProblemsAreValid(generated);
    if (!allGeneratedProblemsAreValid || generated.length !== templates.length) {
      res.status(503).json({
        error:
          "Could not generate a fresh substantive question set. No canned questions were substituted.",
      });
      return;
    }

    const finalProblems = templates.map((t, i) => {
      const g = generated[i];
      return {
        topicId: t.topicId,
        prompt: g!.prompt.trim(),
        correctAnswer: g!.correctAnswer.trim(),
        explanation:
          (g!.explanation ?? "").trim() ||
          "Explain your reasoning using the core mechanism this problem targets.",
      };
    });

    const [session] = await db
      .insert(practiceSessionsTable)
      .values({
        weekNumber: assignment.weekNumber,
        topicId: null,
        assignmentId: assignment.id,
        mode: "assignment",
        tutorEnabled: true,
        focusOnWeaknesses: false,
        difficulty: 2.5,
      })
      .returning();
    if (!session) {
      res.status(500).json({ error: "failed to create practice session" });
      return;
    }

    const inserted = await db
      .insert(practiceProblemsTable)
      .values(
        finalProblems.map((p) => ({
          sessionId: session.id,
          topicId: p.topicId,
          prompt: p.prompt,
          correctAnswer: p.correctAnswer,
          explanation: p.explanation,
          difficulty: 2.5,
        })),
      )
      .returning();

    const topicTitleById = new Map(
      templates.map((t) => [t.topicId, t.topicTitle ?? null]),
    );

    res.json(
      GeneratePracticeAssignmentResponse.parse({
        sessionId: session.id,
        assignmentId: assignment.id,
        title: assignment.title,
        kind: assignment.kind,
        instructions: assignment.instructions ?? null,
        problems: inserted.map((p) => ({
          id: p.id,
          prompt: p.prompt,
          topicId: p.topicId,
          topicTitle: topicTitleById.get(p.topicId) ?? null,
        })),
      }),
    );
  },
);

// Grade every answer in a practice-assignment set and return rich coaching
// feedback per problem. Practice is never penalized — the score is purely
// informational so the student can see if they're ready for the real thing.
router.post(
  "/practice/assignment-sessions/:sessionId/grade",
  async (req, res): Promise<void> => {
    const sessionId = parseIdParam(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
      res.status(400).json({ error: "invalid sessionId" });
      return;
    }
    const parsed = GradePracticeAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [session] = await db
      .select()
      .from(practiceSessionsTable)
      .where(eq(practiceSessionsTable.id, sessionId));
    if (!session) {
      const recoverable = parsed.data.answers.every(
        (answer) => typeof answer.prompt === "string" && answer.prompt.trim(),
      );
      if (!recoverable) {
        res.status(409).json({
          error:
            "This temporary practice session is no longer available. Your answers remain on this page; submit again after the app updates.",
        });
        return;
      }

      const recoveredResults = await Promise.all(
        parsed.data.answers.map(async (answer) => {
          const prompt = answer.prompt!.trim();
          const graded = await gradeRecoveredPracticeEssay({
            prompt,
            userAnswer: answer.answer,
          });
          return {
            problemId: answer.problemId,
            prompt,
            correct: graded.correct,
            scorePercent: graded.scorePercent,
            userAnswer: answer.answer,
            correctAnswer: graded.modelAnswer,
            feedback: graded.feedback,
          };
        }),
      );
      const score = recoveredResults.filter((result) => result.correct).length;
      res.json(
        GradePracticeAssignmentResponse.parse({
          score,
          total: recoveredResults.length,
          percent:
            recoveredResults.length > 0
              ? Math.round((score / recoveredResults.length) * 100)
              : 0,
          results: recoveredResults,
        }),
      );
      return;
    }
    if (session.mode !== "assignment") {
      res
        .status(400)
        .json({ error: "session is not an assignment practice session" });
      return;
    }

    const problems = await db
      .select()
      .from(practiceProblemsTable)
      .where(eq(practiceProblemsTable.sessionId, sessionId))
      .orderBy(asc(practiceProblemsTable.id));

    const answerByProblem = new Map(
      parsed.data.answers.map((a) => [a.problemId, a]),
    );

    const submittedProblems = problems.filter((problem) =>
      answerByProblem.has(problem.id),
    );
    const results = await Promise.all(
      submittedProblems.map(async (problem) => {
        const submitted = answerByProblem.get(problem.id);
        const answer = submitted?.answer ?? "";
        const graded = await gradePracticeEssay({
          prompt: problem.prompt,
          correctAnswer: problem.correctAnswer,
          userAnswer: answer,
        });

        await db.insert(practiceAttemptsTable).values({
          sessionId,
          problemId: problem.id,
          topicId: problem.topicId,
          answer,
          correct: graded.correct,
          difficulty: problem.difficulty,
          trace: submitted?.trace ?? null,
        });

        return {
          problemId: problem.id,
          prompt: problem.prompt,
          correct: graded.correct,
          scorePercent: graded.scorePercent,
          userAnswer: answer,
          correctAnswer: problem.correctAnswer,
          feedback: graded.feedback,
        };
      }),
    );

    const total = results.length;
    const score = results.filter((r) => r.correct).length;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    res.json(
      GradePracticeAssignmentResponse.parse({
        score,
        total,
        percent,
        results,
      }),
    );
  },
);

export default router;
