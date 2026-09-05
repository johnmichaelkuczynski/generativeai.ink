import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, lecturesTable } from "@workspace/db";
import { AskTutorBody, AskTutorResponse } from "@workspace/api-zod";
import { chatText, chatJson, FAST_MODEL } from "../lib/ai";

const router: IRouter = Router();

router.get("/tutor/suggestions/:lectureId", async (req, res): Promise<void> => {
  const lectureId = Number(req.params.lectureId);
  if (!Number.isFinite(lectureId)) {
    res.status(400).json({ error: "invalid lectureId" });
    return;
  }
  const [lecture] = await db
    .select()
    .from(lecturesTable)
    .where(eq(lecturesTable.id, lectureId));
  if (!lecture) {
    res.status(404).json({ error: "lecture not found" });
    return;
  }

  const SYSTEM_PROMPT =
    'You are a rigorous Evolutionary Psychology tutor writing study questions. Reply as strict JSON of the form {"questions": string[]} with NO other keys.';
  const buildUserPrompt = (extra: string) =>
    extra +
    `From the lecture below, write 6 starter questions that make the student APPLY the lecture's ideas to a CONCRETE NAMED SCENARIO. Every question must name a person, organization, product, or deployed feature and ask the student to reason about that case.\n\n` +
    `THE SINGLE MOST IMPORTANT RULE: every question must contain an explicit, realistic behavioral, developmental, or research situation. It must ask the student to analyze evidence, judge an evolutionary hypothesis, compare an alternative, or predict a conditional result in THAT named scenario. Reuse concrete lecture cases when available.\n\n` +
    `ABSOLUTELY FORBIDDEN — never produce any of these:\n` +
    `- Questions that ask for a definition ("What is X?", "What does X mean?", "Define X").\n` +
    `- Questions that ask to distinguish or compare concepts in the abstract ("How do X and Y differ?", "What is the difference between X and Y?", "How does X relate to Y?").\n` +
    `- Questions about terminology, labels, or what something is "called".\n` +
    `- Any question that could be answered without referring to a specific named case.\n` +
    `- One-word, terminology-recall, or bare yes/no questions; every answer must require multiple sentences of reasoning.\n\n` +
    `If a question does not name a concrete example and ask the student to reason about it, REWRITE it until it does.\n\n` +
    `GOOD vs BAD:\n` +
    `- BAD: "What's the difference between vertical and horizontal scaling?"\n` +
    `- GOOD: "Harbor University's one-city mating-preference sample shows an average difference; explain what Maya can conclude and what evidence she still needs."\n` +
    `- BAD: "What is a security group?"\n` +
    `- GOOD: "Northstar's Wason study improves with social-contract wording; judge which matched controls Priya should add."\n\n` +
    `Cover several major ideas across the 6 questions. Require cautious framing: hypotheses are not established facts, averages do not determine individuals, and evolutionary explanations do not justify conduct. One clear sentence each, answerable in 1–3 sentences.\n\n` +
    `Return exactly 6 questions.\n\nLECTURE TITLE: ${lecture.title}\n\nLECTURE BODY:\n"""\n${lecture.body}\n"""`;

  // Reject abstract / definition / comparison questions so none reach the UI.
  // Kept precise to avoid false-positives on valid case questions (e.g. "What
  // should Alex do after lying?"), since the prompt + retry do the heavy lifting.
  const isAbstract = (q: string): boolean => {
    const t = q.toLowerCase().trim();
    const capitalized = q.match(/\b[A-Z][A-Za-z]*(?:['’]s)?\b/g) ?? [];
    const questionWords = new Set([
      "A",
      "An",
      "At",
      "For",
      "How",
      "In",
      "The",
      "What",
      "When",
      "Where",
      "Which",
      "Why",
    ]);
    const hasNamedScenario = capitalized.some(
      (word) => !questionWords.has(word.replace(/['’]s$/, "")),
    );
    const requiresReasoning =
      /\b(analy[sz]e|explain|judge|decide|predict|recommend|diagnose|justify|reason|evaluate|should)\b/.test(
        t,
      );
    return (
      !hasNamedScenario ||
      !requiresReasoning ||
      /\bdefine\b/.test(t) ||
      /\bwhat does .+\bmean\b/.test(t) ||
      /\bwhat (is|are) (the )?(meaning|definition)\b/.test(t) ||
      /\bdifference between\b/.test(t) ||
      /\bhow (do|does) .+ (differ|relate)\b/.test(t) ||
      /\bwhat (distinguishes|makes) .+ (from|rather than)\b/.test(t) ||
      /\bwhat (is|are) .+ called\b/.test(t)
    );
  };

  const generate = async (extra: string): Promise<string[]> => {
    const out = await chatJson<{ questions: string[] }>(
      SYSTEM_PROMPT,
      buildUserPrompt(extra),
      FAST_MODEL,
    );
    return Array.isArray(out?.questions)
      ? out.questions.filter((q) => typeof q === "string" && q.trim().length > 0)
      : [];
  };

  try {
    const good: string[] = [];
    const seen = new Set<string>();
    const retryNote =
      "Your previous attempt included abstract, definition-style, or unnamed questions, which are unacceptable. EVERY question MUST name a specific person, community, study, or observed behavior and require evidence-based reasoning about its concrete situation. ";
    // Bounded refill loop: regenerate until we have 6 concrete questions.
    for (let attempt = 0; attempt < 3 && good.length < 6; attempt++) {
      const batch = (await generate(attempt === 0 ? "" : retryNote)).filter(
        (q) => !isAbstract(q),
      );
      for (const q of batch) {
        if (good.length >= 6) break;
        const key = q.toLowerCase().trim();
        if (!seen.has(key)) {
          good.push(q);
          seen.add(key);
        }
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ questions: good.slice(0, 6) });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.json({ questions: [] });
  }
});

router.post("/tutor/ask", async (req, res): Promise<void> => {
  const parsed = AskTutorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, selectedLectureText } = parsed.data;

  const sys =
    "You are an encouraging Evolutionary Psychology tutor. Teach and apply substantive mechanisms spanning natural and sexual selection, parental investment, kin selection, reciprocal altruism, cooperation, emotion, cognition, development, life history, and mismatch. Use concrete cases and quantitative predictions when appropriate. Do not default to generic methodological caution or repeatedly answer that more evidence or alternatives are needed. Keep replies short (3-6 sentences) unless asked for more. Never just give the answer — guide the student.";
  const user = selectedLectureText
    ? `Context from the lecture the student is reading:\n"""\n${selectedLectureText}\n"""\n\nStudent question: ${message}`
    : message;

  let text = "";
  try {
    text = await chatText(sys, user);
  } catch {
    text =
      "I'm having trouble reaching the tutor service right now. Try again in a moment, and consider re-reading the relevant section of the lecture.";
  }
  res.json(AskTutorResponse.parse({ text, audioUrl: null }));
});

export default router;
