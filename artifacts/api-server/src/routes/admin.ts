import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, problemsTable } from "@workspace/db";
import { RunGraderLabResponse } from "@workspace/api-zod";
import { gradeAnswer } from "../lib/grading";
import { chatJson } from "../lib/ai";

const router: IRouter = Router();

interface GeneratedCase {
  label: string;
  kind: string;
  expectedCorrect: boolean;
  answer: string;
}

const GENERATION_SYSTEM = [
  "You generate a test bench of candidate STUDENT answers so an administrator can audit how an Evolutionary Psychology grader scores them.",
  "You are given a QUESTION and its MODEL ANSWER. Produce a wide spread of candidate answers that probe the grader.",
  "",
  "`expectedCorrect` is what a FAIR grader — one that scores ONLY on substance / on whether the student supplied what the QUESTION asks for, and that completely ignores grammar, spelling, capitalization, sentence fragments, notes, shorthand, wording, and formatting — SHOULD return for that answer.",
  "",
  "Generate at least these kinds (use the `kind` value shown):",
  "- correct_full: correct content, polished complete sentences. expectedCorrect=true",
  "- correct_fragment: correct content written as terse sentence fragments or notes. expectedCorrect=true",
  "- correct_allcaps: correct content in ALL CAPS / shorthand / abbreviations. expectedCorrect=true",
  "- correct_paraphrase: correct content phrased very differently or using a different example than the model answer. expectedCorrect=true",
  "- correct_minimal_bonus_omitted: correctly answers exactly what the question asks but omits extra detail that is in the model answer yet NOT demanded by the question. expectedCorrect=true",
  "- wrong_fluent: substantively WRONG but written as confident, well-formed complete sentences. expectedCorrect=false",
  "- wrong_fragment: substantively WRONG, written as fragments. expectedCorrect=false",
  "- missing_required: addresses the topic but fails to provide the key content the question actually requires. expectedCorrect=false",
  "- off_topic: irrelevant / does not answer the question. expectedCorrect=false",
  "",
  "Give each case a short human-readable `label`. Keep answers realistic and concise (1-4 sentences/fragments).",
  'Output strict JSON: {"cases": [{"label": string, "kind": string, "expectedCorrect": boolean, "answer": string}]}.',
].join("\n");

router.post("/admin/grader-lab", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as {
    problemId?: number | null;
    prompt?: string | null;
    correctAnswer?: string | null;
  };

  let prompt = (body.prompt ?? "").trim();
  let correctAnswer = (body.correctAnswer ?? "").trim();

  if (body.problemId != null && Number.isFinite(body.problemId)) {
    const [p] = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.id, body.problemId));
    if (!p) {
      res.status(404).json({ error: "problem not found" });
      return;
    }
    prompt = p.prompt;
    correctAnswer = p.correctAnswer;
  }

  if (!prompt || !correctAnswer) {
    res
      .status(400)
      .json({ error: "provide problemId, or both prompt and correctAnswer" });
    return;
  }

  let generated: GeneratedCase[] = [];
  try {
    const out = await chatJson<{ cases: GeneratedCase[] }>(
      GENERATION_SYSTEM,
      JSON.stringify({ question: prompt, model_answer: correctAnswer }),
    );
    generated = Array.isArray(out.cases) ? out.cases : [];
  } catch {
    generated = [];
  }

  // Always include a genuinely blank answer as a control.
  generated.push({
    label: "Blank / no answer",
    kind: "blank",
    expectedCorrect: false,
    answer: "",
  });

  // Grade every candidate on substance only — no AI detection runs here.
  const cases = await Promise.all(
    generated.map(async (g) => {
      const graded = await gradeAnswer({
        prompt,
        correctAnswer,
        userAnswer: g.answer ?? "",
      });
      const expectedCorrect = !!g.expectedCorrect;
      return {
        label: g.label || g.kind || "case",
        kind: g.kind || "unknown",
        expectedCorrect,
        answer: g.answer ?? "",
        gradedCorrect: graded.correct,
        explanation: graded.explanation,
        match: expectedCorrect === graded.correct,
      };
    }),
  );

  res.json(RunGraderLabResponse.parse({ prompt, correctAnswer, cases }));
});

export default router;
