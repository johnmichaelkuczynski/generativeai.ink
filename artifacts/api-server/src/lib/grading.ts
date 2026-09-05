import { chatJson } from "./ai";

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u2212\u2010-\u2015]/g, "-")
    .replace(/[$,]/g, "")
    .replace(/[)(\[\]{}]/g, "")
    .replace(/\s*=\s*/g, "=");
}

function asNumber(s: string): number | null {
  const cleaned = s.replace(/[$,%\s]/g, "").replace(/[\u2212]/g, "-");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return parseFloat(cleaned);
  const frac = cleaned.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const n = parseFloat(frac[1]!);
    const d = parseFloat(frac[2]!);
    if (d !== 0) return n / d;
  }
  return null;
}

export async function gradeAnswer(opts: {
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
}): Promise<{ correct: boolean; explanation: string }> {
  const user = opts.userAnswer ?? "";
  const correct = opts.correctAnswer ?? "";

  if (normalize(user) === normalize(correct)) {
    return {
      correct: true,
      explanation: `Correct. ${correct}`,
    };
  }

  const u = asNumber(user);
  const c = asNumber(correct);
  if (u != null && c != null) {
    const tol = Math.max(0.01, Math.abs(c) * 0.01);
    if (Math.abs(u - c) <= tol) {
      return { correct: true, explanation: `Correct. The expected answer is ${correct}.` };
    }
  }

  if (!user.trim()) {
    return {
      correct: false,
      explanation: `No answer was provided.`,
    };
  }

  try {
    const out = await chatJson<{ correct: boolean; explanation: string }>(
      [
        "You grade answers for Nano Evolutionary Psychology. Judge whether the student's answer is ACTUALLY CORRECT using expert knowledge of adaptation and evidence, gene-culture coevolution, EEA, sexual strategies, kinship and altruism, cooperation, emotion, cognition, development, pathology, and mismatch. Preserve cautious scientific framing: hypotheses are not facts, population patterns are not individual destinies, and evolutionary explanation is not moral justification. Judge on substance alone.",
        "",
        "About the reference answer:",
        "- A `reference_answer` is provided. It is only a FALLIBLE HINT from the course materials — it may be incomplete, narrow, or simply WRONG. It is NOT ground truth.",
        "- Do not grade by similarity to the reference. Grade by whether the student's answer is actually correct on the merits.",
        "- If the student is actually correct but differs from — or even contradicts — the reference, mark `correct` = true. If the reference itself is wrong, ignore it and judge the student on the truth.",
        "",
        "How to decide `correct`:",
        "- First work out what the question stem actually requires, then judge whether the student genuinely supplies a correct answer to it.",
        "- Mark `correct` = true when the student's answer is substantively correct — even if phrased completely differently, and even if it omits extra material the reference happened to include. If two answers do not differ in substance, they MUST get the same grade.",
        "- Mark `correct` = false only when the answer is substantively wrong or genuinely fails to answer the question.",
        "",
        "NEVER lower the grade for any of these — they do not affect correctness at all:",
        "- Grammar, spelling, punctuation, or capitalization (ALL CAPS is completely fine).",
        "- Sentence fragments, notes, bullet points, shorthand, abbreviations, 'e.g.' examples, or otherwise incomplete sentences. Content expressed in fragments earns the same grade as content in full prose.",
        "- Not following formatting or length instructions (e.g. 'write 4-6 sentences'). Only correctness of content matters — never obedience to form or instructions.",
        "- Wording, structure, or examples that differ from the reference while being correct.",
        "",
        "Keep `explanation` neutral, factual, and respectful — never snippy, sarcastic, or dismissive. 1-3 short sentences stating why the answer is or isn't correct on the merits.",
        "",
        'Output strict JSON {"correct": boolean, "explanation": string}.',
      ].join("\n"),
      JSON.stringify({
        question_asked: opts.prompt,
        reference_answer: correct,
        student_answer: user,
      }),
    );
    return {
      correct: !!out.correct,
      explanation: out.explanation || `The correct answer is ${correct}.`,
    };
  } catch {
    return {
      correct: false,
      explanation: `The correct answer is ${correct}.`,
    };
  }
}

// Rich, coaching-style feedback for PRACTICE assignments. Unlike gradeAnswer
// (which returns a terse 1-3 sentence verdict for graded work), this returns
// generous, structured feedback designed to help a student improve before they
// sit the real graded version. Practice is never penalized, so feedback leans
// encouraging and specific.
export async function gradePracticeEssay(opts: {
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
}): Promise<{ correct: boolean; feedback: string }> {
  const user = (opts.userAnswer ?? "").trim();
  const correct = opts.correctAnswer ?? "";

  if (!user) {
    return {
      correct: false,
      feedback: `You left this one blank. Give it a real attempt — even a rough draft — and resubmit for feedback.\n\n**Model answer:** ${correct}`,
    };
  }

  try {
    const out = await chatJson<{
      correct: boolean;
      feedback: string;
    }>(
      [
        "You are a warm, rigorous Evolutionary Psychology tutor giving feedback on a PRACTICE answer (never penalized — the goal is to help the student improve before the real graded version).",
        "",
        "Decide `correct` by whether the student's answer is ACTUALLY CORRECT on the merits, using expert knowledge of evolutionary psychology and cautious scientific inference — not by similarity to any reference. A `reference_answer` is provided, but it is only a FALLIBLE HINT from the course materials: it may be incomplete, narrow, or simply WRONG, and is NOT ground truth. If the student is actually correct but differs from or contradicts the reference, mark `correct` = true; if the reference is wrong, ignore it.",
        "",
        "Work out what the question actually asks for, then mark `correct` = true if the student genuinely supplies a correct answer. Accept paraphrases, different wording, different examples, and equivalent reasoning. If two answers do not differ in substance they get the same result.",
        "",
        "NEVER lower `correct` for grammar, spelling, capitalization (ALL CAPS is fine), sentence fragments, notes, bullet points, shorthand, abbreviations, incomplete sentences, or for not following formatting/length instructions. Only correctness of content matters — never form or obedience.",
        "",
        "Then write `feedback` as encouraging Markdown with these sections: **What you got right** (be specific, cite their wording), **What's missing or off** (only genuine errors or gaps that make the answer actually wrong — never nitpick form, grammar, or divergence from the reference when the student is correct), and **How to strengthen it** (1-2 concrete next steps). 4-8 sentences total, neutral and supportive in tone — never snippy.",
        "",
        'Output strict JSON {"correct": boolean, "feedback": string}.',
      ].join("\n"),
      JSON.stringify({
        question_asked: opts.prompt,
        reference_answer: correct,
        student_answer: user,
      }),
    );
    return {
      correct: !!out.correct,
      feedback:
        out.feedback ||
        `Here's the model answer to compare against:\n\n${correct}`,
    };
  } catch {
    return {
      correct: false,
      feedback: `I couldn't reach the grader just now. Compare your answer against the model answer and try again:\n\n**Model answer:** ${correct}`,
    };
  }
}
