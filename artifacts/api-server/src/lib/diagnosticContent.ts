// ---------------------------------------------------------------------------
// Original content for the embedded diagnostic reasoning assessments.
//
// Two instruments, each offered at FOUR time-points (phases) so a student can
// gauge themselves before, during, and after the course:
//   - subject  — Evolutionary Psychology reasoning. Realistic short cases about
//     behavioral hypotheses and evidence; the best-supported answer
//     is keyed first.
//   - general  — General Reasoning. Genuine reasoning items spanning analysis,
//     inference, evaluation, deduction, and induction (NOT a "docility"/agree-
//     with-authority test).
//
// Each (instrument, phase) is offered in THREE selectable answer formats that
// share the same kind of questions:
//   - mcq     — pick the single best option.
//   - hybrid  — pick the best option AND (optionally) write a short note.
//   - written — no options shown; write a short answer in your own words.
//
// These diagnostics are UNGRADED practice: takeable anytime, unlimited times,
// and they never affect the course grade. Every time a test is started, fresh
// questions are generated (see reasoning.ts) so questions never repeat. The
// items below are the structural BLUEPRINT (style + fallback) for that
// generation, grounded per phase by GEN_SPECS.
//
// All items are ORIGINAL. For every item the correct option is written FIRST;
// at seed time options are rotated so the correct answer lands at a varied
// index (see seedDiagnostics.ts). `modelAnswer` is the ideal short written
// response used to grade the written/hybrid formats.
// ---------------------------------------------------------------------------

export type SkillArea =
  | "analysis"
  | "inference"
  | "evaluation"
  | "deduction"
  | "induction";

export type Instrument = "subject" | "general";

export type Phase = "before" | "third" | "twothirds" | "after";

export type DiagFormat = "mcq" | "hybrid" | "written";

// A single unified diagnostic item. The correct option is listed FIRST and is
// rotated to a random index at seed time. `modelAnswer` is the reference answer
// for grading the written/hybrid formats.
export type DiagItem = {
  prompt: string;
  options: string[];
  modelAnswer: string;
  skillArea?: SkillArea;
};

export type DiagnosticSeed = {
  instrument: Instrument;
  phase: Phase;
  format: DiagFormat;
  title: string;
  subtitle: string;
  instructions: string;
  items: DiagItem[];
};

// ===========================================================================
// Phase metadata
// ===========================================================================

export const PHASE_ORDER: Phase[] = ["before", "third", "twothirds", "after"];

export const PHASE_LABEL: Record<Phase, string> = {
  before: "Before the course",
  third: "One-third of the way through",
  twothirds: "Two-thirds of the way through",
  after: "After the course",
};

// ===========================================================================
// Per-(instrument, phase) generation specs
// Used by reasoning.ts to generate fresh, never-repeating questions grounded in
// the right scope for the chosen time-point. `topicFocus` describes WHAT to ask
// about; `level` nudges difficulty for the time-point.
// ===========================================================================

export type GenSpec = { topicFocus: string; level: string };

const SUBJECT_SPECS: Record<Phase, GenSpec> = {
  before: {
    level:
      "Intro level: answerable by a thoughtful newcomer before lessons. Do not require technical vocabulary; reward brief plain-language reasoning from details in the scene.",
    topicFocus:
      "Basic scientific framing: adaptation is a hypothesis rather than a synonym for useful; evolutionary and proximate explanations can coexist; evolved does not mean fixed, universal, or morally justified; culture and genes can coevolve. Use accessible behavioral cases without requiring jargon.",
  },
  third: {
    level:
      "Early course level: covers Session 1 fundamentals. Keep cases brief and one-sentence-friendly.",
    topicFocus:
      "Session 1: natural selection, adaptation evidence, gene-culture coevolution, EEA; parental investment, sexual selection and dimorphism, conditional short- and long-term strategies; inclusive fitness and Hamilton's rule, reciprocal altruism, parent-offspring conflict; theory of mind, cheater detection and Wason tasks, coalitions and flexible group boundaries.",
  },
  twothirds: {
    level:
      "Mid-course level: covers all of Session 1 and early Session 2. Use short cases requiring one clear diagnostic step.",
    topicFocus:
      "All Session 1 concepts plus Session 2 emotion and motivation: fear, anger, disgust, jealousy, status or dominance, happiness and well-being; and cognitive adaptations: domain-specific versus domain-general accounts, heuristics and biases, and cautious language-evolution hypotheses.",
  },
  after: {
    level:
      "End-of-course level: covers both sessions. Use concise integrative cases, still answerable in one sentence.",
    topicFocus:
      "The full course, adding evolutionary developmental psychology (attachment, life-history allocation, childhood and plasticity) and pathology or mismatch (ancestral-modern mismatch, competing accounts of mental disorders, supernormal stimuli). Require cautious, probabilistic inference and alternatives.",
  },
};

const GENERAL_SPECS: Record<Phase, GenSpec> = {
  before: {
    level: "Everyday, accessible reasoning. One step of inference per item.",
    topicFocus:
      "General reasoning on everyday, neutral topics: identifying assumptions and conclusions, what evidence does and does not support, judging the strength of sources, valid vs. invalid deduction, and the strength of generalizations.",
  },
  third: {
    level: "Everyday reasoning, slightly more demanding than the baseline.",
    topicFocus:
      "General reasoning on everyday, neutral topics: assumptions/conclusions, supported inferences, source quality, deductive validity, and inductive strength.",
  },
  twothirds: {
    level: "Moderately demanding reasoning, sometimes two steps.",
    topicFocus:
      "General reasoning on everyday, neutral topics: assumptions/conclusions, supported inferences, source quality, deductive validity, and inductive strength.",
  },
  after: {
    level: "More demanding, multi-step reasoning where appropriate.",
    topicFocus:
      "General reasoning on everyday, neutral topics: assumptions/conclusions, supported inferences, source quality, deductive validity, and inductive strength.",
  },
};

export function genSpecFor(instrument: Instrument, phase: Phase): GenSpec {
  return instrument === "subject"
    ? SUBJECT_SPECS[phase]
    : GENERAL_SPECS[phase];
}

// ===========================================================================
// Format-specific instructions
// ===========================================================================

const FORMAT_LABEL: Record<DiagFormat, string> = {
  mcq: "Multiple Choice",
  hybrid: "Hybrid",
  written: "Written",
};

function instructionsFor(instrument: Instrument, format: DiagFormat): string {
  const subject =
    instrument === "subject"
      ? "Answer each Evolutionary Psychology case — these reward careful reasoning from the scene, not memorized definitions"
      : "Answer each reasoning question — these measure how you think, not what you recall";
  const body =
    format === "mcq"
      ? `${subject} by selecting the single best option.`
      : format === "hybrid"
        ? `${subject} by selecting the best option. You can add a quick note on your reasoning if you like — it's optional and a few words is plenty.`
        : `${subject}. No answer options are shown — just jot a brief answer in your own words. One or two sentences is plenty; there's no need to write a lot.`;
  return `${body} This is ungraded practice — take it anytime, as many times as you like; it never affects your course grade. Submitting shows your results with written feedback.`;
}

// ===========================================================================
// SUBJECT — Evolutionary Psychology blueprint cases (best answer keyed FIRST)
// ===========================================================================

const SUBJECT_BEFORE: DiagItem[] = [
  {
    prompt:
      "A commentator says a behavior seen today must be an adaptation because it is currently useful; what is the best correction?",
    options: [
      "Current usefulness is insufficient; adaptation requires evidence that past selection shaped the feature for that effect",
      "Every useful behavior is genetically fixed",
      "Any learned behavior cannot involve evolved capacities",
      "A plausible ancestral story is decisive evidence",
    ],
    modelAnswer:
      "Adaptation is a historical causal claim requiring discriminating evidence, not merely a label for something useful now.",
  },
  {
    prompt:
      "A study finds an average sex difference in one dating sample, and a reporter says it determines every individual's strategy; which response is best?",
    options: [
      "Average differences can coexist with large overlap and context-sensitive individual strategies",
      "Every member of a sex must match its average",
      "Culture makes all biological hypotheses impossible",
      "One sample establishes a human universal",
    ],
    modelAnswer:
      "Group averages do not diagnose individuals, and strategy hypotheses should test overlap, context, ecology, and culture.",
  },
  {
    prompt:
      "A speaker says an evolved tendency is morally right and cannot be changed by institutions; what is the strongest evaluation?",
    options: [
      "An origin claim neither justifies conduct nor implies developmental or institutional inflexibility",
      "Natural selection makes all outcomes ethically good",
      "Evolved mechanisms never use environmental input",
      "Institutions cannot alter behavior",
    ],
    modelAnswer:
      "This confuses description with justification and evolution with determinism.",
  },
];

const SUBJECT_THIRD: DiagItem[] = [
  {
    prompt:
      "In a community where both parents invest heavily, a researcher predicts universal male pursuit of short-term mating; what should be investigated first?",
    options: [
      "Whether ecology, biparental care, opportunity, institutions, and individual overlap support a conditional rather than universal prediction",
      "Whether every man reports the same preference",
      "Whether parental investment has no relevance to humans",
      "Whether the prediction sounds natural",
    ],
    modelAnswer:
      "Parental-investment predictions are conditional and population-level, so local ecology and overlapping strategies must be measured.",
    skillArea: "analysis",
  },
  {
    prompt:
      "Related siblings help one another, while unrelated neighbors help only when they expect future meetings; which account best fits the contrast?",
    options: [
      "Inclusive fitness may predict kin help, while reciprocal altruism predicts contingent repeated exchange among non-kin",
      "Hamilton's rule explains only help among unrelated strangers",
      "Reciprocity requires genetic relatedness",
      "Both patterns prove conscious fitness calculation",
    ],
    modelAnswer:
      "The two theories use different conditions: relatedness-weighted effects versus repeated interaction and defector control.",
    skillArea: "inference",
  },
  {
    prompt:
      "People detect a social-contract violation more readily than an abstract Wason-rule violation; which study best tests a specialized cheater-detection account?",
    options: [
      "Compare logically matched familiar and deontic controls while isolating benefit-without-cost violations",
      "Repeat the social task without controls",
      "Ask whether participants value fairness",
      "Assume improved performance proves tribal hostility",
    ],
    modelAnswer:
      "Matched controls can distinguish social-contract specialization from familiarity, pragmatics, or general reasoning.",
    skillArea: "evaluation",
  },
];

const SUBJECT_TWOTHIRDS: DiagItem[] = [
  {
    prompt:
      "News exposure makes rare dangers easy to recall, and viewers overestimate their frequency; which conclusion is best?",
    options: [
      "An availability heuristic may be efficient with representative memories but biased in this media environment",
      "The error proves humans have no useful reasoning capacities",
      "Any memorable event is objectively common",
      "Domain-general learning cannot interact with evolved tendencies",
    ],
    modelAnswer:
      "The scenario supports a context-dependent heuristic account, not a claim of global irrationality.",
    skillArea: "evaluation",
  },
  {
    prompt:
      "Employees defer freely to a skilled mentor but obey another manager only because of threats; what distinction best organizes the evidence?",
    options: [
      "The mentor receives prestige, while the threatening manager relies on dominance",
      "Both relationships prove identical status mechanisms",
      "Prestige always requires physical force",
      "Status has no cultural inputs",
    ],
    modelAnswer:
      "Prestige is voluntarily granted for valued competence, whereas dominance rests on cost-imposition capacity.",
    skillArea: "inference",
  },
  {
    prompt:
      "A fear experiment shows many false alarms but few missed threats; what evidence would support a smoke-detector account?",
    options: [
      "The relative costs of missing threats exceed false alarms and thresholds shift predictably with perceived danger",
      "Every false alarm is a disorder",
      "Fear is unaffected by learning",
      "Any unpleasant feeling is maladaptive",
    ],
    modelAnswer:
      "Asymmetric error costs and cue-sensitive thresholds would provide discriminating support while leaving room for learning.",
    skillArea: "analysis",
  },
];

const SUBJECT_AFTER: DiagItem[] = [
  {
    prompt:
      "A child uses a caregiver as a secure base but becomes more avoidant after caregiving changes; which conclusion is best?",
    options: [
      "Attachment is a developing regulatory system influenced by experience, not a fixed lifelong type",
      "The first classification permanently determines personality",
      "Attachment has no biological organization",
      "Caregiving cannot alter attachment behavior",
    ],
    modelAnswer:
      "The change supports probabilistic developmental plasticity rather than destiny.",
    skillArea: "evaluation",
  },
  {
    prompt:
      "A study links unpredictable childhood hardship with adult risk-taking and calls hardship beneficial; what correction is strongest?",
    options: [
      "Test probabilistic developmental predictions and alternatives; a possibly calibrated response can carry costs and does not make adversity good",
      "Every exposed child must develop the same strategy",
      "Life-history labels prove causation",
      "Development is independent of institutions",
    ],
    modelAnswer:
      "Adaptive-history hypotheses do not imply inevitability, welfare, or moral endorsement.",
    skillArea: "inference",
  },
  {
    prompt:
      "Heavy notification use correlates with anxiety, so a researcher calls the disorder an adaptation to phones; what evidence is missing?",
    options: [
      "Longitudinal or experimental evidence linking altered cues through a specified mismatch mechanism to impairment while controlling alternatives",
      "A stronger ancestral story without new data",
      "Proof that all anxiety is adaptive",
      "A claim that correlation fixes causal direction",
    ],
    modelAnswer:
      "Mismatch could contribute without making disorder adaptive; mechanism and causal direction require direct tests.",
    skillArea: "evaluation",
  },
];

// ===========================================================================
// GENERAL — reasoning blueprint (analysis / inference / evaluation /
// deduction / induction). Shared across phases; difficulty is nudged per phase
// at generation time (see GEN_SPECS.level).
// ===========================================================================

const GENERAL_BLUEPRINT: DiagItem[] = [
  {
    prompt:
      "Consider: 'All students who studied passed the exam. Maria studied. So Maria passed.' Which unstated assumption does the argument rely on?",
    options: [
      "Maria is among the students the first statement describes.",
      "Studying is the only way to pass the exam.",
      "Maria always studies for her exams.",
      "The exam was unusually difficult.",
    ],
    modelAnswer:
      "It assumes Maria is one of the students covered by 'all students who studied' — that her studying puts her in the group described.",
    skillArea: "analysis",
  },
  {
    prompt:
      "A survey finds 70% of people who exercise daily report good sleep, versus 30% of those who never exercise. Which conclusion is best supported?",
    options: [
      "People who exercise daily are more likely to report good sleep than those who never exercise.",
      "Exercise guarantees good sleep for everyone.",
      "Poor sleep is what causes people to stop exercising.",
      "Anyone who wants good sleep must exercise daily.",
    ],
    modelAnswer:
      "Only that daily exercisers are more likely to report good sleep — an association, not a guarantee or a proven cause.",
    skillArea: "inference",
  },
  {
    prompt: "Which source would most strengthen the claim 'this medication is safe'?",
    options: [
      "A large, peer-reviewed clinical trial.",
      "A testimonial from one satisfied customer.",
      "An advertisement produced by the manufacturer.",
      "A popular wellness blog post.",
    ],
    modelAnswer:
      "A large, peer-reviewed clinical trial — independent, systematic evidence is far stronger than a testimonial, an ad, or a blog.",
    skillArea: "evaluation",
  },
  {
    prompt:
      "A neighbor insists it rained overnight. You know that if it had rained, the streets would be wet — and stepping outside, you see the streets are not wet. What necessarily follows?",
    options: [
      "It did not rain.",
      "It rained.",
      "The streets are dry for some other reason.",
      "Nothing at all follows.",
    ],
    modelAnswer:
      "It did not rain — if rain would have made the streets wet and they are not wet, then it cannot have rained.",
    skillArea: "deduction",
  },
  {
    prompt:
      "Plants given a new fertilizer grew taller than otherwise identical plants without it, all else held equal. The best-supported conclusion is:",
    options: [
      "The fertilizer probably caused the extra growth.",
      "Taller plants attract more fertilizer.",
      "Fertilizer is required for any plant growth at all.",
      "The result was pure coincidence.",
    ],
    modelAnswer:
      "Because everything else was held equal, the fertilizer probably caused the extra growth.",
    skillArea: "induction",
  },
  {
    prompt:
      "A report notes that ice-cream sales and drowning deaths rise in the same months. A careful reader should infer that:",
    options: [
      "Both may be linked to a third factor, such as hot weather.",
      "Eating ice cream causes drowning.",
      "Drowning incidents cause ice-cream sales.",
      "The data must simply be mistaken.",
    ],
    modelAnswer:
      "That both probably rise because of a shared third factor such as hot weather — correlation doesn't mean one causes the other.",
    skillArea: "inference",
  },
];

// ===========================================================================
// Seed expansion — each (instrument, phase) in all three formats
// ===========================================================================

type BaseContent = {
  instrument: Instrument;
  phase: Phase;
  baseTitle: string;
  items: DiagItem[];
};

const BASE_CONTENT: BaseContent[] = PHASE_ORDER.flatMap((phase) => {
  const subjectItems: Record<Phase, DiagItem[]> = {
    before: SUBJECT_BEFORE,
    third: SUBJECT_THIRD,
    twothirds: SUBJECT_TWOTHIRDS,
    after: SUBJECT_AFTER,
  };
  return [
    {
      instrument: "subject" as const,
      phase,
      baseTitle: `Evolutionary Psychology Check — ${PHASE_LABEL[phase]}`,
      items: subjectItems[phase],
    },
    {
      instrument: "general" as const,
      phase,
      baseTitle: `General Reasoning Check — ${PHASE_LABEL[phase]}`,
      items: GENERAL_BLUEPRINT,
    },
  ];
});

const FORMATS: DiagFormat[] = ["mcq", "hybrid", "written"];

export const DIAGNOSTIC_SEED: DiagnosticSeed[] = BASE_CONTENT.flatMap((base) =>
  FORMATS.map((format) => ({
    instrument: base.instrument,
    phase: base.phase,
    format,
    title: `${base.baseTitle} · ${FORMAT_LABEL[format]}`,
    subtitle: PHASE_LABEL[base.phase],
    instructions: instructionsFor(base.instrument, format),
    items: base.items,
  })),
);
