export type QuestionFormat =
  | "multiple_choice"
  | "one_sentence"
  | "one_to_three_sentences"
  | "one_paragraph";

const FORMAL_PRINCIPLE_NAME =
  /\b(?:Hamilton(?:'s|’s) rule|kin selection|inclusive fitness|reciprocal altruism|parental investment(?: theory)?|sexual selection|life[- ]history(?: theory|allocation|tradeoffs?)?|error[- ]management(?: theory)?|pathogen avoidance|coalitional psychology|theory of mind|supernormal stimul(?:us|i)|cheater detection)\b/i;

export function usesFormalPrincipleName(prompt: string): boolean {
  return FORMAL_PRINCIPLE_NAME.test(prompt);
}

const PLAIN_LANGUAGE_PRINCIPLES: Array<[RegExp, string]> = [
  [/Hamilton(?:'s|’s) rule/gi, "the relatedness-weighted benefit-versus-cost rule"],
  [/\bkin selection\b/gi, "selection favoring aid to genetic relatives when weighted benefits exceed costs"],
  [/\binclusive fitness\b/gi, "relatedness-weighted reproductive payoff"],
  [/\breciprocal altruism\b/gi, "cooperation sustained by repeated interaction and responses to cheating"],
  [/\bparental investment(?: theory)?\b/gi, "costly care that improves offspring prospects at the expense of other opportunities"],
  [/\bsexual selection\b/gi, "selection through mating competition and mate choice"],
  [/\blife[- ]history(?: theory|allocation|tradeoffs?)?\b/gi, "allocation among growth, maintenance, mating, and parenting"],
  [/\berror[- ]management(?: theory)?\b/gi, "a bias toward the less costly mistake"],
  [/\bpathogen avoidance\b/gi, "behavior that reduces exposure to possible infection"],
  [/\bcoalitional psychology\b/gi, "tracking alliances, loyalty, status, and threat"],
  [/\btheory of mind\b/gi, "reasoning about another person's beliefs and intentions"],
  [/\bsupernormal stimul(?:us|i)\b/gi, "an exaggerated cue that evokes an unusually strong response"],
  [/\bcheater detection\b/gi, "tracking whether someone took a benefit without paying the required cost"],
];

export function rewriteFormalPrincipleNames(text: string): string {
  return PLAIN_LANGUAGE_PRINCIPLES.reduce(
    (rewritten, [pattern, replacement]) =>
      rewritten.replace(pattern, replacement),
    text,
  );
}

// Exact rolling 50-question distribution:
// 30 MC (60%), 15 one sentence (30%), 4 short responses (8%), 1 paragraph (2%).
export function questionFormatForOrdinal(ordinal: number): QuestionFormat {
  const slot = ((ordinal % 50) + 50) % 50;
  if (slot < 30) return "multiple_choice";
  if (slot < 45) return "one_sentence";
  if (slot < 49) return "one_to_three_sentences";
  return "one_paragraph";
}

export function questionFormatInstruction(format: QuestionFormat): string {
  switch (format) {
    case "multiple_choice":
      return "MULTIPLE CHOICE: put the complete scenario and question first, ending with a question mark. Then provide exactly two or three options labeled A) and B), with C) optional. Prefer three unless a genuinely binary distinction makes two clearer. Include one best answer and only plausible alternatives. Never include D). The correctAnswer must repeat the complete correct option, including its letter.";
    case "one_sentence":
      return "ONE-SENTENCE ANSWER: explicitly say “Answer in one sentence.” The model answer must be exactly one sentence.";
    case "one_to_three_sentences":
      return "SHORT ANSWER: explicitly say “Answer in 1–3 sentences.” The model answer must be 1–3 sentences.";
    case "one_paragraph":
      return "RARE PARAGRAPH ANSWER: explicitly say “Answer in one paragraph of 5–7 sentences.” The model answer must be one paragraph of 5–7 sentences.";
  }
}

export function questionMatchesFormat(
  prompt: string,
  answer: string,
  format: QuestionFormat,
): boolean {
  const sentenceCount = answer
    .trim()
    .split(/[.!?]+(?:\s|$)/)
    .filter(Boolean).length;
  if (format === "multiple_choice") {
    const firstOptionIndex = prompt.search(/(?:^|\s)A\)\s+/);
    const stem = firstOptionIndex >= 0 ? prompt.slice(0, firstOptionIndex).trim() : "";
    const labels = [...prompt.matchAll(/(?:^|\s)([A-C])\)\s+/g)].map(
      (match) => match[1],
    );
    return (
      stem.length >= 40 &&
      stem.endsWith("?") &&
      (labels.length === 2 || labels.length === 3) &&
      labels.every((label, index) => label === String.fromCharCode(65 + index)) &&
      !/(?:^|\s)D\)\s+/.test(prompt) &&
      /^[A-C]\)\s+\S/.test(answer.trim())
    );
  }
  if (format === "one_sentence") {
    return sentenceCount === 1 && /answer in one sentence/i.test(prompt);
  }
  if (format === "one_to_three_sentences") {
    return (
      sentenceCount >= 1 &&
      sentenceCount <= 3 &&
      /answer in 1[–-]3 sentences/i.test(prompt)
    );
  }
  return (
    sentenceCount >= 5 &&
    sentenceCount <= 7 &&
    /one paragraph of 5[–-]7 sentences/i.test(prompt) &&
    !/\n\s*\n/.test(answer)
  );
}

export function fallbackQuestion(
  format: QuestionFormat,
  topic: string,
): { prompt: string; correctAnswer: string; explanation: string } {
  const scenario = `At Northstar University, Maya observes one behavioral pattern and claims it proves a fixed evolutionary explanation involving ${topic}.`;
  if (format === "multiple_choice") {
    return {
      prompt: `${scenario} Which response is best? A) One observation proves the explanation. B) Treat it as a hypothesis and test alternatives, context, development, and discriminating evidence. C) Any cultural influence disproves evolution. D) An evolutionary explanation makes the behavior inevitable.`,
      correctAnswer:
        "B) Treat it as a hypothesis and test alternatives, context, development, and discriminating evidence.",
      explanation:
        "The cautious answer treats evolutionary accounts as testable hypotheses rather than deterministic conclusions.",
    };
  }
  if (format === "one_sentence") {
    return {
      prompt: `${scenario} State the most important correction and one needed test. Answer in one sentence.`,
      correctAnswer:
        "Maya should treat the explanation as a hypothesis and compare it with cultural, developmental, and contextual alternatives using evidence that distinguishes their predictions.",
      explanation:
        "Full credit rejects certainty from one observation and names discriminating evidence.",
    };
  }
  if (format === "one_to_three_sentences") {
    return {
      prompt: `${scenario} Evaluate the inference and identify evidence that could distinguish the hypothesis from an alternative. Answer in 1–3 sentences.`,
      correctAnswer:
        "The observation is compatible with the hypothesis but does not establish it or make the pattern inevitable. Maya should compare its predictions with cultural, developmental, and contextual alternatives using cross-population, longitudinal, or experimental evidence.",
      explanation:
        "Full credit separates compatibility from proof and proposes discriminating evidence.",
    };
  }
  return {
    prompt: `${scenario} Evaluate the inference, explain two plausible alternatives, identify discriminating evidence, and state the limits of the conclusion. Answer in one paragraph of 5–7 sentences.`,
    correctAnswer:
      "The observation is compatible with an evolutionary hypothesis, but one pattern does not establish the explanation. Cultural learning could produce the same behavior through local norms and reinforcement. Developmental experience could also calibrate responses to conditions Maya has not measured. She should derive distinct predictions from each account before collecting more data. Cross-population comparisons, longitudinal evidence, and experiments could help distinguish those predictions. Even supportive results would describe probabilistic tendencies rather than an inevitable outcome for every person.",
    explanation:
      "Full credit evaluates the inference, gives alternatives, proposes discriminating evidence, and avoids determinism.",
  };
}