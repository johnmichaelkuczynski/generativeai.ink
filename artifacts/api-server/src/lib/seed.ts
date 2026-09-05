import { db } from "@workspace/db";
import {
  topicsTable,
  lecturesTable,
  assignmentsTable,
  problemsTable,
  seedMetaTable,
} from "@workspace/db";
import { eq, sql, and, like, notInArray } from "drizzle-orm";
import { logger } from "./logger";

// Content version of the seeded curriculum. BUMP THIS whenever the TOPICS or
// ASSIGNMENTS content below changes. On boot, seedIfEmpty compares this against
// the value stored in seed_meta; a mismatch forces a full re-seed, so content
// edits self-heal in every environment (including a republished production)
// without a manual database wipe.
const SEED_CONTENT_VERSION = "2026-09-05-nano-evolutionary-psychology-v2";

type SeedTopic = {
  slug: string;
  title: string;
  weekNumber: number;
  blurb: string;
  lectureTitle: string;
  body: string;
  bodyMedium: string;
  bodyLong: string;
};

const TOPICS: SeedTopic[] = [
  {
    slug: "evolutionary-foundations",
    title: "Evolution, mating, kinship, and cooperation",
    weekNumber: 1,
    blurb:
      "Build a cautious evidence-based framework for evolutionary hypotheses, then apply it to mating, kin relationships, altruism, social cognition, and cooperation.",
    lectureTitle: "Evolution, mating, kinship, and cooperation",
    body: `# Evolution, mating, kinship, and cooperation

Evolutionary psychology asks whether recurrent selection pressures helped shape psychological mechanisms. It does not imply that every behavior is adaptive, fixed, universal, morally good, or explained by genes alone. Good analysis separates an **evolutionary hypothesis** from evidence and competing developmental, cultural, learning, and by-product explanations.

## 1. Foundations

**Natural selection** changes inherited variants when they reliably affect reproductive success. An **adaptation** is a reliably developing feature shaped by selection because of past effects; current usefulness alone is not enough. Evidence may include cross-cultural patterns, comparative data, development, design specificity, and experimental predictions. The **environment of evolutionary adaptedness (EEA)** is not one place or a claim that humans stopped evolving: it refers to statistically recurrent ancestral conditions relevant to a mechanism. **Gene-culture coevolution** recognizes feedback: cultural practices alter selection pressures, while evolved learning capacities shape which practices spread.

## 2. Mate selection and sexual strategies

**Sexual selection** concerns traits affecting mating competition or choice. **Parental investment theory** predicts that the sex investing more in offspring will often be choosier, while the other may compete more, but ecology, individual condition, sex ratios, institutions, and culture can alter or reverse average patterns. Sexual dimorphism can provide comparative clues, not a complete behavioral script. Humans can pursue short- or long-term strategies conditionally; observed sex differences are distributions with overlap, not rules for individuals.

## 3. Kinship and altruism

**Inclusive fitness** includes effects on one's own reproduction and on relatives, weighted by relatedness. Hamilton's rule, **rB > C**, predicts when a costly helping allele could spread; it does not say organisms consciously calculate kinship or that all family help is genetic. **Reciprocal altruism** can evolve among non-kin when partners meet repeatedly, benefits exceed costs, and cheaters can be detected or excluded. Parent and offspring share interests but are not genetically identical, producing **parent-offspring conflict** over investment while leaving extensive scope for attachment and care.

## 4. Social cognition and cooperation

**Theory of mind** supports inferences about others' beliefs and intentions, though its development depends on maturation and social experience. Conditional-reasoning studies, including Wason tasks framed as social contracts, have been used to argue for specialized **cheater detection**; alternative accounts invoke familiarity, pragmatics, or general reasoning, so task contrasts matter. Coalition psychology may support alliance tracking and rapid “us/them” categorization, but group boundaries are flexible and culturally supplied. Describing such tendencies neither excuses prejudice nor makes conflict inevitable.`,
    bodyMedium: `# Evolution, mating, kinship, and cooperation

## Scientific framing

Evolutionary explanations concern why information-processing tendencies may have been selected; proximate explanations concern hormones, learning, development, and immediate goals. Both can be true. Adaptation claims should make risky predictions and be compared with by-product, drift, general-learning, and cultural explanations. Present behavior does not reveal ancestral function by itself, and “evolved” never means immutable or justified.

## 1. Foundations

Natural selection requires heritable variation and systematic differences in reproductive outcomes. Adaptations show evidence of functional design for recurrent past problems; exaptations were selected for another role, and by-products accompany other features. The EEA is a distribution of relevant ancestral conditions, varying by mechanism rather than a mythical single savanna. Gene-culture coevolution is illustrated by dairying: a cultural practice changed selection on adult lactose digestion, while social learning enabled the practice to persist.

When evaluating a claim such as “people prefer calorie-rich food because it was advantageous ancestrally,” ask for specific predictions, comparisons, developmental evidence, and alternatives. A modern preference could reflect an evolved bias, learning, current scarcity, marketing, or their interaction.

## 2. Mate selection and sexual strategies

Parental investment includes resources that increase one offspring's prospects at a cost to other reproductive opportunities. Where minimum investment differs, average choice and competition may differ, but human biparental care, cooperative breeding, ecology, autonomy, and norms complicate simple predictions. Sexual selection includes both mate choice and competition within a sex; dimorphism offers one imperfect historical clue.

Short- and long-term strategies are conditional allocations, not personality boxes. A strong study measures actual tradeoffs, distinguishes stated preference from behavior, samples beyond affluent populations, and reports overlap and context. Evolutionary hypotheses cannot justify coercion, infidelity, or unequal institutions.

## 3. Kinship and altruism

Hamilton's rule rB > C is an accounting condition: helping is favored when relatedness times the recipient's benefit exceeds the helper's cost. It predicts patterns across relevant contexts, not conscious arithmetic. Kin recognition can use cues such as co-residence, maternal association, or social labels, which can misfire; adoption and friendship show that care is not reducible to genetic relatedness.

Reciprocal altruism is favored by repeated interaction, memory, partner choice, and sanctions. Reputation and indirect reciprocity broaden cooperation, but cultural institutions can transform incentives. Parent-offspring conflict predicts disagreement over timing or allocation of investment because relatedness to current and potential siblings differs; it does not predict constant hostility.

## 4. Social cognition and cooperation

Theory of mind permits prediction from another person's false belief rather than from reality. Performance varies with language, executive demands, age, and social experience. In social-contract Wason tasks, people often detect a benefit-taker who failed to pay a cost more readily than an abstract rule violation. That pattern is consistent with specialized cheater detection, but controls for familiarity and pragmatic clarity are needed.

Humans form coalitions, track loyalty, and categorize groups quickly. Minimal-group experiments show how little can trigger favoritism, while cross-cutting identities and institutions show boundaries can change. Evolutionary accounts are probabilistic hypotheses about cognition, not claims that tribalism is desirable or unavoidable.`,
    bodyLong: `# Evolution, mating, kinship, and cooperation

## How to reason scientifically

Evolutionary psychology links ultimate questions about selection history with proximate questions about mechanism and development. These are complementary levels, not rivals. A proposed adaptation should identify the recurrent problem, the information available, the mechanism's design features, and predictions that distinguish it from learning, culture, drift, or a by-product. Cross-cultural recurrence can support a claim but does not alone prove genetic adaptation; cultural diffusion can also recur. Likewise, variation does not refute an evolved mechanism if the hypothesis predicts conditional responses.

Avoid three errors. The naturalistic fallacy treats what evolved as morally right. Genetic determinism treats development as independent of environments. Just-so storytelling accepts a plausible ancestral tale without discriminating evidence. Responsible conclusions use terms such as “consistent with,” state uncertainty, and identify alternatives.

## 1. Foundations

Natural selection operates when variants are heritable and affect reproductive success in a given environment. Adaptations are products of past selection, so a feature can persist after its environment changes, and a useful current effect can be incidental. Researchers seek converging evidence: comparative patterns, cross-cultural and within-cultural variation, developmental timing, experimental responses to predicted cues, physiological or computational design, and—in some cases—genetic evidence.

The EEA means the recurring selection-relevant inputs over many generations. Different systems had different relevant environments: pathogen defense depends on contamination patterns, while social exchange depends on repeated interaction. Human evolution also continued through the Holocene. Gene-culture coevolution rejects a genes-versus-culture split: cooking, pastoralism, agriculture, and institutions altered environments; evolved imitation, teaching, and norm psychology influenced cultural transmission.

*Case:* If a food preference is strongest only after repeated advertising, that weakens a simple invariant-adaptation claim but may fit an evolved learning bias interacting with a constructed market environment. The design must compare these models rather than choosing one by label.

## 2. Mate selection and sexual strategies

Sexual selection arises from competition for mating opportunities and mate choice. Parental investment theory predicts strategic consequences from costs that increase offspring survival while limiting alternative reproduction. Yet humans have flexible pair bonds, paternal investment, alloparents, concealed ovulation, and strong institutions. Operational sex ratio, mortality, resource control, contraception, and gender norms can reshape behavior.

Sexual dimorphism in size or ornamentation can suggest historical mating competition when interpreted comparatively, but it cannot identify one modern preference. Short-term strategies may prioritize immediate mating opportunities; long-term strategies may prioritize compatibility, investment, and reliability. Individuals can shift with age, condition, opportunity, risk, and goals. Means do not diagnose a person: distributions overlap substantially, and within-sex variation may exceed an average between-sex difference.

Evidence is stronger when preregistered predictions distinguish strategies, behavior is measured rather than inferred from stereotypes, representative cultures are sampled, and alternative economic or norm-based explanations are tested. No evolutionary explanation turns a preference into entitlement or excuses harm.

## 3. Kinship and altruism

Inclusive-fitness theory explains how alleles influencing help can spread through effects on genetic relatives. In rB > C, r is relatedness, B the recipient's reproductive benefit, and C the actor's cost. The rule applies to marginal effects under specified assumptions. Psychological mechanisms need only respond to historically informative cues; they need not represent genes or calculate the inequality.

Humans use fallible cues of kinship, including early co-residence and maternal association, plus culturally defined categories. Therefore kin-directed behavior can be shaped by both evolved cue systems and institutions. Reciprocal altruism instead concerns repeated exchange among individuals who may be unrelated. Future interaction, memory, detection, punishment, apology, and partner switching can stabilize it. One-shot anonymous generosity may involve reputation, internalized norms, signaling, empathy, or experimental expectations rather than simple direct reciprocity.

Parent-offspring conflict follows because a child is fully related to itself but usually less related to siblings, whereas a parent is similarly related to each child. Predictions concern disagreements over weaning, attention, or resource allocation—not an absence of love. Testing requires separating conflict predictions from developmental need and local ecology.

## 4. Social cognition and cooperation

Theory of mind enables reasoning about beliefs, desires, knowledge, and intentions. False-belief tasks test whether a participant predicts action from an agent's mistaken belief. Language and executive-control demands affect performance, so failure on one task is not proof that the capacity is absent.

Wason selection tasks ask which cards must be checked to test “if P, then Q.” Performance often improves when the rule is “if you take a benefit, you must pay a cost,” and violations correspond to cheaters. This finding motivated a domain-specific social-contract account. Competing accounts emphasize familiar content, deontic reasoning, and pragmatic interpretation. Carefully matched controls—not the memorable result alone—decide between them.

Coalition mechanisms may track alliances, obligations, status, and threats. Minimal groups can elicit rapid favoritism, but categorization shifts when new alliances or superordinate goals become salient. “Tribal psychology” is therefore not a fixed map of enemies. Norms, repeated contact, cross-cutting identities, and fair institutions can widen cooperation. Scientific description must never be used to naturalize discrimination.`,
  },
  {
    slug: "minds-development-mismatch",
    title: "Emotion, cognition, development, and mismatch",
    weekNumber: 1,
    blurb:
      "Evaluate evolutionary accounts of emotion, cognitive adaptations, development, life history, pathology, mismatch, and modern supernormal stimuli.",
    lectureTitle: "Emotion, cognition, development, and mismatch",
    body: `# Emotion, cognition, development, and mismatch

## 5. Emotion and motivation

Evolutionary hypotheses treat emotions as coordinated responses to recurrent situations, not as infallible commands. **Fear** may prioritize threat avoidance; **anger** may bargain against imposed costs; **disgust** may reduce pathogen exposure; **jealousy** may respond to relationship threats; and **status or dominance** motives may track influence and deference. Each account requires evidence because learning, appraisal, physiology, personality, and culture shape triggers and expression. **Happiness and well-being** may partly signal progress toward goals or supportive relationships, but adaptation is not designed to maximize permanent happiness.

## 6. Cognitive adaptations

A **domain-specific** account proposes mechanisms specialized for recurring information structures; a **domain-general** account emphasizes flexible learning, memory, and executive processes. They can interact, and evidence must compare predictions. **Heuristics** are efficient shortcuts under constraints; biases can be costs of generally useful rules, artifacts of tasks, or mismatches—not proof that humans are simply irrational. Language-evolution hypotheses include adaptation for communication, exaptation, cultural evolution, and gene-culture feedback; fossils do not preserve grammar, so conclusions rely on converging but incomplete evidence.

## 7. Evolutionary developmental psychology

Selection shapes developmental systems, not finished adult traits. **Attachment** organizes proximity and exploration around caregivers; caregiver sensitivity predicts patterns, but classifications are not destinies. **Life-history theory** concerns allocation among growth, maintenance, mating, and parenting under constraints; applying it to individual psychology requires careful measurement and avoidance of simplistic “fast/slow” labels. Childhood's long duration may support learning, play, social rehearsal, and brain development. Plasticity can be adaptive while early adversity still imposes harm.

## 8. Pathology and mismatch

**Mismatch** occurs when a mechanism encounters conditions different from those that shaped it. Easy access to concentrated food, endless social comparison, or attention-capturing media may amplify old preferences. **Supernormal stimuli** exaggerate features that normally guide behavior, but the label does not establish addiction or pathology. Mental disorders may involve malfunction, harmful extremes of normal defenses, tradeoffs, developmental disruption, mismatch, or causes unrelated to adaptation. Clinical claims need direct evidence and must not replace diagnosis or treatment.`,
    bodyMedium: `# Emotion, cognition, development, and mismatch

## 5. Emotion and motivation

Emotions coordinate attention, memory, physiology, and action. Fear can be biased toward false alarms when missing a real threat was historically costlier; this “smoke-detector” hypothesis predicts asymmetrical errors but does not explain every anxiety disorder. Anger may communicate that another person should place greater weight on one's welfare. Disgust has pathogen, sexual, and moral usages, yet moral disgust can be metaphorical and culturally learned.

Jealousy hypotheses distinguish threats to attachment, investment, and exclusivity, but average sex differences are context-sensitive and cannot identify individuals. Status can be gained through dominance (cost imposition) or prestige (freely granted deference for valued skill). Happiness may regulate pursuit and affiliation; adaptation often favors responsive motivation rather than unbroken contentment. Evidence should include behavior and physiology, not only self-report stories.

## 6. Cognitive adaptations

Domain specificity is a question of input, representation, and function, not an all-or-none claim that modules are isolated. Face processing and social exchange may show specialization; working memory and executive control contribute broadly. Experiments should match difficulty and familiarity before attributing performance to a special-purpose mechanism.

Heuristics such as availability and loss aversion can be useful in some ecologies and misleading in others. A bias label describes a pattern relative to a benchmark; it does not supply its cause. Language has biological prerequisites and culturally evolving forms. Adaptationist, exaptation, gesture-first, vocal, and cultural-evolution accounts make partially distinct predictions, but sparse historical evidence warrants calibrated confidence.

## 7. Evolutionary developmental psychology

Development uses inherited systems, social input, nutrition, stress, and chance. Attachment is a dynamic regulatory system: secure-base behavior changes with caregiver availability and context. Early patterns predict outcomes only probabilistically and can change.

Life-history models address allocation tradeoffs across the life course. Ecological unpredictability may influence development, but human findings are mixed and confounded by deprivation, institutions, and measurement. Childhood permits protected exploration, language learning, play, and acquisition of local subsistence and social skills. Calling plasticity “adaptive” describes a possible selection history, not that adversity benefits children.

## 8. Pathology and mismatch

Mismatch hypotheses specify an ancestral input, a changed modern input, a mechanism, and a predicted outcome. Ultra-processed foods and variable-reward notifications may act as supernormal stimuli by magnifying sweetness or social-reward cues, but controlled evidence is needed.

For disorders, alternatives include defense dysregulation, mutation load, tradeoffs, developmental injury, infection, social conditions, and mismatch. Some low mood or anxiety may have functional components without major depression or panic disorder being adaptive. Evolutionary formulation may generate research questions; it neither blames patients nor substitutes for evidence-based care.`,
    bodyLong: `# Emotion, cognition, development, and mismatch

## A method for evaluating claims

For each claim, identify the proposed ancestral problem, cue, response, benefit, cost, and modern prediction. Then ask whether a developmental, cultural, or general-process model predicts the same result. Prefer preregistered, cross-cultural, longitudinal, clinical, and experimental evidence over retrospective stories. Mechanisms are probabilistic and context sensitive; an explanation of origins is not moral approval.

## 5. Emotion and motivation

Fear systems may learn rapidly about cues ancestrally associated with danger and tolerate false alarms. A smoke-detector model predicts that defensive thresholds depend on relative error costs. Yet modern phobias also reflect conditioning, observation, cognition, and individual vulnerability. Anger has been modeled as bargaining: it may signal that another should revise a harmful allocation. Tests should measure whether anger tracks bargaining power and welfare tradeoffs rather than assuming all aggression has one function.

Disgust can reduce contact with pathogens through cues of spoilage or contamination. Pregnancy-related changes and local disease ecology offer tests, while culture strongly calibrates targets. Moral condemnation should not automatically be treated as pathogen defense. Jealousy can motivate mate guarding or relationship repair when a valued bond is threatened. Forced-choice studies of sex differences are debated because wording, norms, and measurement alter results; distributions overlap.

Status is multidimensional. Dominance relies on threat, whereas prestige follows respected competence. People may monitor rank because it affected access to allies and resources, but institutions define valued skills and can limit coercion. Happiness and well-being correlate with relationships, autonomy, health, meaning, and material security. Hedonic adaptation may keep goals responsive, but it is not evidence that suffering is beneficial or unavoidable.

## 6. Cognitive adaptations

Domain-specific mechanisms process restricted kinds of information or solve recurring classes of problem; domain-general systems support flexible control across tasks. Most behavior recruits both. A cheater-detection task, for example, requires reading, memory, and rule representation even if specialized social-contract computations contribute. Neural localization alone does not prove an evolved module.

Heuristics economize on time and information. Availability can track environmental frequency when memorable instances are representative, but media exposure can distort it. Loss aversion may reflect asymmetric consequences, reference-dependent valuation, or experimental framing. Researchers must specify a normative benchmark and ecological conditions before calling a response biased.

Language depends on vocal or gestural control, social inference, learning, and structured combinatorial capacities. Hypotheses include direct selection for communication, selection on components later assembled or exapted, and cultural adaptation of languages to learnability. Comparative communication, genetics, development, typology, and archaeology each constrain the story, but none alone reconstructs language origins. Cautious synthesis is stronger than certainty.

## 7. Evolutionary developmental psychology

Evolution designs developmental rules that use environmental input. Attachment behavior balances caregiver proximity with exploration under perceived safety. Secure, avoidant, resistant, and disorganized classifications summarize observations; they are not fixed essences. Caregiving, temperament, stress, and culture influence expression, and later relationships can change trajectories.

Life-history theory models finite allocation to growth, somatic maintenance, learning, mating effort, and parenting. Translating species-level theory into psychological scales is controversial. Claims that harshness automatically creates a “fast strategy” risk circularity and ignore structural constraints. Strong studies measure ecology independently, follow development over time, and test mediators.

Extended childhood may permit large brains to mature, accumulation of local knowledge, cooperative care, play, and flexible social learning. Play can rehearse motor, social, and imaginative skills, though not every game is an adaptation. Developmental plasticity can make the best of difficult conditions without making those conditions good: a response may reduce one risk while imposing later costs.

## 8. Pathology and mismatch

Mismatch is a testable relation, not a catch-all. Researchers should specify how current environments differ from selection-relevant distributions and show that the proposed mechanism mediates harm. Concentrated sugar can exceed ancestral sweetness cues; algorithmic feeds can deliver rapid, repeated novelty and social feedback. These may be supernormal stimuli—exaggerated cue configurations that elicit unusually strong responses—but dose, individual differences, and causal outcomes still require study.

Evolutionary models of mental disorder include malfunction of selected systems, extremes or dysregulation of defenses, antagonistic tradeoffs, mutation-selection balance, developmental insult, infection, social adversity, and mismatch. Fever can be a defense, yet dangerously high fever needs treatment; similarly, possible functions of ordinary anxiety do not make disabling anxiety disorders beneficial. Clinical categories involve distress and impairment, and evolutionary speculation should complement—not displace—clinical evidence.

*Case:* A researcher finds that heavy notification use correlates with low mood and calls depression an adaptation to smartphones. The inference fails: smartphones are recent, correlation does not establish direction, and a mismatch hypothesis should identify attention or social-comparison mechanisms and test them experimentally or longitudinally. Even support for mismatch would not imply that depression itself is an adaptation.`,
  },
];

type SeedAssignment = {
  kind: "homework" | "test" | "midterm" | "final";
  title: string;
  weekNumber: number;
  isTimed: boolean;
  timeLimitMinutes: number | null;
  instructions: string;
  problems: Array<{
    topicSlug: string;
    prompt: string;
    correctAnswer: string;
    explanation: string;
    hint?: string;
  }>;
};

const ASSIGNMENTS: SeedAssignment[] = [
  {
    kind: "homework",
    title: "Homework 1 — Evolution, mating, kinship, and cooperation",
    weekNumber: 1,
    isTimed: false,
    timeLimitMinutes: null,
    instructions:
      "Untimed Session 1 practice. Select one answer for multiple choice; answer the short item in 1–2 sentences. Every item requires reasoning from a scenario.",
    problems: [
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "A researcher finds that people in one city prefer sweet foods and concludes, “This preference is an adaptation, so culture and learning are irrelevant.” Which response is best? A) Current usefulness proves adaptation. B) The pattern fits several hypotheses; test design specificity, development, cultures, and learning before inferring adaptation. C) Any cultural effect disproves evolution. D) The EEA was one fixed place that determines every modern choice.",
        correctAnswer:
          "B) The pattern fits several hypotheses; test design specificity, development, cultures, and learning before inferring adaptation.",
        explanation:
          "A contemporary pattern does not establish an adaptation or exclude gene-culture and learning effects.",
      },
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "In a fishing community, siblings share food more often than strangers, but unrelated partners also exchange food repeatedly and stop helping defectors. Explain how inclusive fitness and reciprocal altruism generate distinct predictions for this pattern. (Answer in 1–2 sentences.)",
        correctAnswer:
          "Inclusive fitness predicts more costly help toward relatives when relatedness-weighted benefits exceed costs under Hamilton's rule. Reciprocal altruism predicts help among non-kin when interaction repeats and defectors can be detected or excluded.",
        explanation:
          "Full credit distinguishes kin-selected effects from contingent repeated exchange without implying conscious calculation.",
        hint: "Ask what relatedness predicts separately from what repeated interaction predicts.",
      },
    ],
  },
  {
    kind: "homework",
    title: "Homework 2 — Emotion, cognition, development, and mismatch",
    weekNumber: 1,
    isTimed: false,
    timeLimitMinutes: null,
    instructions:
      "Untimed Session 2 practice. Select one answer for each multiple-choice scenario.",
    problems: [
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "A child performs poorly on a verbally complex false-belief task, and a commentator concludes that the child has no theory of mind. Which evaluation is best? A) One task proves the entire capacity is absent. B) Theory of mind is only cultural. C) Compare simpler tasks and control language and executive demands before drawing that conclusion. D) False-belief performance is unrelated to development.",
        correctAnswer:
          "C) Compare simpler tasks and control language and executive demands before drawing that conclusion.",
        explanation:
          "Task failure can reflect language or executive load, so converging measures are needed.",
      },
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "A social-media app supplies unpredictable likes and endless novel clips. A writer calls it a supernormal stimulus and says that label proves it causes a mental disorder. Which response is best? A) The label proves diagnosis. B) Exaggerated reward cues support a mismatch hypothesis, but causal effects, impairment, dose, and alternatives still require evidence. C) Modern stimuli cannot engage evolved systems. D) Any strong preference is a disorder.",
        correctAnswer:
          "B) Exaggerated reward cues support a mismatch hypothesis, but causal effects, impairment, dose, and alternatives still require evidence.",
        explanation:
          "A supernormal-stimulus label is a mechanistic hypothesis, not evidence of causation or clinical disorder by itself.",
      },
    ],
  },
  {
    kind: "test",
    title: "Course Test — Nano Evolutionary Psychology",
    weekNumber: 1,
    isTimed: true,
    timeLimitMinutes: 15,
    instructions:
      "Timed. 15 minutes. Select one answer for multiple choice; answer the short item in 1–3 sentences. Keystrokes are screened for AI use.",
    problems: [
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "In a society where both parents provide intensive infant care and women control substantial resources, a student predicts all men will seek only short-term mates because males always invest less. Which answer best evaluates the prediction? A) It follows inevitably from sex. B) Parental investment predicts context-sensitive average tradeoffs; biparental care, ecology, institutions, and overlapping strategies make the absolute prediction unsupported. C) Sexual selection cannot apply to humans. D) Culture erases every evolved influence.",
        correctAnswer:
          "B) Parental investment predicts context-sensitive average tradeoffs; biparental care, ecology, institutions, and overlapping strategies make the absolute prediction unsupported.",
        explanation:
          "Parental investment generates conditional population-level hypotheses, not deterministic claims about every person.",
      },
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "Participants solve a social-contract Wason task better than an abstract task, and investigators claim a dedicated cheater-detection adaptation. Which follow-up most directly strengthens that claim? A) Repeat only the same wording. B) Compare matched familiar and deontic controls while preserving logical structure, showing a selective advantage for benefit-without-cost violations. C) Ask whether participants like cooperation. D) Treat any correct answer as proof of tribalism.",
        correctAnswer:
          "B) Compare matched familiar and deontic controls while preserving logical structure, showing a selective advantage for benefit-without-cost violations.",
        explanation:
          "Matched controls distinguish specialized social-contract reasoning from familiarity, pragmatics, or general reasoning.",
      },
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "After growing up under unpredictable hardship, a teenager shows earlier risk-taking. Explain how to frame a life-history hypothesis without treating the outcome as inevitable or the hardship as beneficial. (Answer in 1–3 sentences.)",
        correctAnswer:
          "The hypothesis predicts probabilistic developmental calibration to independently measured unpredictability, but deprivation, institutions, learning, and individual differences are alternatives or moderators. Longitudinal evidence is needed, and a possibly adaptive response to danger can still carry costs and does not make hardship good.",
        explanation:
          "Full credit states a conditional hypothesis, alternatives, and the distinction between adaptive history and welfare.",
      },
    ],
  },
  {
    kind: "final",
    title: "Final — Nano Evolutionary Psychology",
    weekNumber: 1,
    isTimed: true,
    timeLimitMinutes: 25,
    instructions:
      "Timed cumulative final. 25 minutes. Select one answer for multiple choice; answer the short item in 1–3 sentences. Keystrokes are screened for AI use.",
    problems: [
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "A manager says employees who react angrily to unfair allocations, feel jealous about partners, and seek promotion are obeying fixed adaptations, so workplace rules cannot change them. Which answer is best? A) Evolved emotions compel behavior and excuse it. B) Anger, jealousy, and status hypotheses concern context-sensitive responses; appraisal, learning, norms, and institutions shape expression, and explanation does not justify conduct. C) Emotions have no evolutionary history. D) Happiness requires winning every status contest.",
        correctAnswer:
          "B) Anger, jealousy, and status hypotheses concern context-sensitive responses; appraisal, learning, norms, and institutions shape expression, and explanation does not justify conduct.",
        explanation:
          "Evolutionary explanations are probabilistic and do not remove cultural regulation or moral responsibility.",
      },
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "A clinic observes anxiety after constant alert notifications and claims: “Ancestral threat detection is mismatched, therefore the patients' disorder is an adaptation and notifications are the sole cause.” Evaluate the reasoning and name evidence that would discriminate the claims. (Answer in 1–3 sentences.)",
        correctAnswer:
          "Mismatch of an ordinarily useful threat system could contribute to symptoms without making the disorder itself adaptive or proving one cause. Longitudinal or experimental notification changes, dose-response evidence, mechanism measures, clinical impairment, and controls for prior anxiety and social stress would discriminate causation from correlation and alternatives.",
        explanation:
          "Full credit separates mechanism, mismatch, disorder, and causation while proposing discriminating evidence.",
      },
    ],
  },
];

type SeedPrimer = Omit<SeedTopic, "bodyMedium" | "bodyLong">;

const REASONING_PRIMERS: SeedPrimer[] = [
  {
    slug: "reasoning-primer-subject",
    title: "How to reason about evolutionary-psychology cases",
    weekNumber: 1,
    blurb:
      "Diagnostic primer: evaluating evolutionary-psychology hypotheses in concrete behavioral cases.",
    lectureTitle: "Primer: How to reason about evolutionary-psychology cases",
    body: `# How to reason about evolutionary-psychology cases

This primer prepares you for the **Nano Evolutionary Psychology** diagnostic. It is ungraded, fresh on every attempt, and asks you to evaluate hypotheses rather than recite terms.

## It tests application, not memorization

A question gives a short behavioral or research scene. Identify the proposed evolutionary mechanism, decide what the evidence supports, compare alternatives such as learning or culture, and point to the detail that discriminates them.

## What the questions reward

- **Separating claim from evidence** — distinguish adaptation hypotheses from current usefulness, by-products, developmental calibration, culture, and mismatch.
- **Using evidence from the scene** — point to the detail in the situation that supports your answer, rather than answering from a general impression.
- **Using cautious inference** — state probabilistic conclusions, population overlap, uncertainty, and plausible competing explanations.

## How to do this activity well

1. **Read the situation first**, then ask which topic it belongs to.
2. **Find the detail that decides it** — what in the scene makes one answer better than another.
3. For written items, **give the core idea in a sentence or two** — clear and correct beats long and padded.

Take it as often as you like; the questions are freshly generated every time, and there is no penalty for any answer.`,
  },
  {
    slug: "reasoning-primer-general",
    title: "Core reasoning skills",
    weekNumber: 1,
    blurb:
      "Diagnostic primer: analysis, inference, evaluation, deduction, and induction.",
    lectureTitle: "Primer: Core reasoning skills",
    body: `# Core reasoning skills

This short primer prepares you for the **General Reasoning** diagnostic — an ungraded, fresh-attempt check of five genuine reasoning skills. The skills remain domain-general, with evolutionary-psychology examples showing how they guide scientific judgment.

## The five skills

- **Analysis** separates an evolutionary hypothesis from proximate mechanisms and moral claims.
- **Inference** distinguishes what a cross-cultural pattern suggests from what it proves.
- **Evaluation** asks whether matched controls discriminate adaptation from familiarity or learning.
- **Deduction** identifies what follows from a conditional model such as Hamilton's rule once its assumptions are supplied.
- **Induction** generalizes cautiously from samples, especially when cultures and individual distributions vary.

## A recurring trap: things that move together

Most wrong answers sound plausible but outrun the evidence. Keep apart observations, proposed functions, developmental causes, and moral judgments. One population pattern can motivate a hypothesis; converging cross-cultural, developmental, comparative, and experimental evidence supports a stronger claim.

## How to do this activity well

1. Find the **point** (conclusion) first, then the reasons.
2. Ask which of the five skills the question is testing (a hidden-assumption question is analysis; a "what follows" question is inference or deduction; a "how good is this reasoning" question is evaluation).
3. Pick the option that follows **only** from what you were given — not the one that merely sounds true or appealing.

Take it as often as you like; the questions are freshly generated every time, and it never affects your grade.`,
  },
];

// Insert any teaching-to-the-test primer lectures whose slug is not yet present.
// Safe to run on every boot: it only adds what is missing.
export async function seedReasoningPrimersIfMissing(): Promise<void> {
  const currentSlugs = REASONING_PRIMERS.map((p) => p.slug);
  // Remove any obsolete primer topics from earlier diagnostic models (their
  // lectures cascade-delete), so renamed/retired primers self-heal instead of
  // stranding stale content in existing or republished databases.
  const stale = await db
    .delete(topicsTable)
    .where(
      and(
        like(topicsTable.slug, "reasoning-primer-%"),
        notInArray(topicsTable.slug, currentSlugs),
      ),
    )
    .returning({ slug: topicsTable.slug });
  if (stale.length > 0) {
    logger.info(
      { removed: stale.map((s) => s.slug) },
      "Reasoning primers: removed obsolete primers",
    );
  }
  let added = 0;
  for (let i = 0; i < REASONING_PRIMERS.length; i++) {
    const t = REASONING_PRIMERS[i]!;
    const existing = await db
      .select({ id: topicsTable.id })
      .from(topicsTable)
      .where(eq(topicsTable.slug, t.slug));
    if (existing.length > 0) continue;
    const [inserted] = await db
      .insert(topicsTable)
      .values({
        slug: t.slug,
        title: t.title,
        weekNumber: t.weekNumber,
        blurb: t.blurb,
        position: 900 + i,
      })
      .returning();
    if (!inserted) throw new Error(`Failed to insert primer ${t.slug}`);
    await db.insert(lecturesTable).values({
      topicId: inserted.id,
      weekNumber: t.weekNumber,
      title: t.lectureTitle,
      body: t.body,
    });
    added += 1;
  }
  if (added > 0) {
    logger.info({ added }, "Reasoning primers seeded");
  } else {
    logger.info("Reasoning primers: already present, skipping");
  }
}

export async function seedIfEmpty(): Promise<void> {
  // Detect the current curriculum marker. If present and version-matched, the
  // marker topic; if present and the content version matches, the content is
  // current and we skip. This makes the seed self-healing across environments:
  // a database that still holds older content (e.g. a previous curriculum) is
  // detected and replaced on boot.
  const markerTopic = await db
    .select({ id: topicsTable.id })
    .from(topicsTable)
    .where(eq(topicsTable.slug, "evolutionary-foundations"));
  // Read the stored content version. Tolerate the seed_meta table not yet
  // existing (e.g. a boot that races ahead of schema migration): treat that as
  // "no version recorded", which forces a reseed once the table is present.
  let currentVersion: string | null = null;
  try {
    const storedVersion = await db
      .select({ value: seedMetaTable.value })
      .from(seedMetaTable)
      .where(eq(seedMetaTable.key, "content_version"));
    currentVersion = storedVersion[0]?.value ?? null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Seed: seed_meta unavailable, treating version as unset");
    currentVersion = null;
  }
  if (markerTopic.length > 0 && currentVersion === SEED_CONTENT_VERSION) {
    logger.info("Seed: course content present and current, skipping");
    return;
  }
  if (markerTopic.length > 0) {
    logger.warn(
      { storedVersion: currentVersion, expected: SEED_CONTENT_VERSION },
      "Seed: course content present but out of date — re-seeding with the current curriculum",
    );
  }

  // No current content. Either the database is empty (fresh) or it still holds
  // an older curriculum. Do the (optional) wipe and the full reseed in a SINGLE
  // transaction so the marker topic only ever becomes visible once the entire
  // curriculum has committed. A crash mid-seed rolls back, so the next boot
  // retries instead of leaving partial content that the marker check would
  // wrongly treat as healthy. TRUNCATE also takes an ACCESS EXCLUSIVE lock, so
  // concurrent readers never observe a half-empty course during the replace
  // window. The diagnostic tables are truncated here too so the (non
  // version-gated) diagnostic seed repopulates them with the current content on
  // the same boot.
  await db.transaction(async (tx) => {
    const existing = await tx.execute(sql`select count(*)::int as n from topics`);
    const row = (existing.rows[0] ?? {}) as { n?: number };
    if ((row.n ?? 0) > 0) {
      logger.warn(
        "Seed: stale course content detected — replacing with Nano Evolutionary Psychology",
      );
      await tx.execute(
        sql`TRUNCATE TABLE answers, attempts, practice_attempts, practice_problems, practice_sessions, problems, assignments, lectures, topics, diagnostic_responses, diagnostic_attempts, diagnostic_items, diagnostic_assessments RESTART IDENTITY CASCADE`,
      );
    } else {
      logger.info("Seed: populating course content");
    }

    // Topics + lectures
    const slugToTopicId = new Map<string, number>();
    for (let i = 0; i < TOPICS.length; i++) {
      const t = TOPICS[i]!;
      const [inserted] = await tx
        .insert(topicsTable)
        .values({
          slug: t.slug,
          title: t.title,
          weekNumber: t.weekNumber,
          blurb: t.blurb,
          position: i,
        })
        .returning();
      if (!inserted) throw new Error(`Failed to insert topic ${t.slug}`);
      slugToTopicId.set(t.slug, inserted.id);
      await tx.insert(lecturesTable).values({
        topicId: inserted.id,
        weekNumber: t.weekNumber,
        title: t.lectureTitle,
        body: t.body,
        bodyMedium: t.bodyMedium,
        bodyLong: t.bodyLong,
      });
    }

    // Assignments + problems
    for (let i = 0; i < ASSIGNMENTS.length; i++) {
      const a = ASSIGNMENTS[i]!;
      const [inserted] = await tx
        .insert(assignmentsTable)
        .values({
          kind: a.kind,
          title: a.title,
          weekNumber: a.weekNumber,
          position: i,
          isTimed: a.isTimed,
          timeLimitMinutes: a.timeLimitMinutes,
          instructions: a.instructions,
        })
        .returning();
      if (!inserted) throw new Error(`Failed to insert assignment ${a.title}`);
      for (let p = 0; p < a.problems.length; p++) {
        const prob = a.problems[p]!;
        const topicId = slugToTopicId.get(prob.topicSlug);
        if (!topicId) throw new Error(`Unknown topic slug ${prob.topicSlug}`);
        await tx.insert(problemsTable).values({
          assignmentId: inserted.id,
          topicId,
          position: p,
          prompt: prob.prompt,
          correctAnswer: prob.correctAnswer,
          explanation: prob.explanation,
          hint: prob.hint ?? null,
        });
      }
    }

    // Stamp the content version last, inside the same transaction, so the
    // marker check on the next boot only treats the course as "current" once
    // the entire curriculum has committed.
    await tx
      .insert(seedMetaTable)
      .values({ key: "content_version", value: SEED_CONTENT_VERSION })
      .onConflictDoUpdate({
        target: seedMetaTable.key,
        set: { value: SEED_CONTENT_VERSION, updatedAt: new Date() },
      });
  });

  logger.info(
    { topics: TOPICS.length, assignments: ASSIGNMENTS.length, version: SEED_CONTENT_VERSION },
    "Seed complete",
  );
}
