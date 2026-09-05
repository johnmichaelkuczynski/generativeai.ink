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
const SEED_CONTENT_VERSION = "2026-09-05-nano-evolutionary-psychology-v3";

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
      "Learn the core evolutionary mechanisms behind mating, kin relationships, altruism, social cognition, and cooperation, then apply their predictions to concrete cases.",
    lectureTitle: "Evolution, mating, kinship, and cooperation",
    body: `# Evolution, mating, kinship, and cooperation

Evolutionary psychology explains how recurrent survival and reproductive problems could shape information-processing mechanisms. The central task is to connect a selection pressure to the cues a mechanism detects, the decisions it regulates, and the behavioral tradeoffs it produces.

## 1. Foundations

**Natural selection** changes inherited variants when they reliably affect reproductive success. An **adaptation** is a reliably developing feature shaped by selection because of its effects in past environments. The **environment of evolutionary adaptedness (EEA)** refers to statistically recurrent ancestral conditions relevant to a mechanism. **Gene-culture coevolution** captures the feedback loop in which cultural practices alter selection pressures while evolved learning capacities shape which practices spread.

## 2. Mate selection and sexual strategies

**Sexual selection** concerns traits affecting mating competition or choice. **Parental investment theory** predicts that the sex facing greater obligatory reproductive costs tends to be more selective, while the lower-investing sex competes more intensely for access to mates. Operational sex ratio, resource control, mortality, and the value of biparental care shift these tradeoffs. Humans conditionally allocate effort between short-term mating, long-term bonding, parenting, and kin support.

## 3. Kinship and altruism

**Inclusive fitness** includes effects on one's own reproduction and on relatives, weighted by relatedness. Hamilton's rule, **rB > C**, predicts when a costly helping allele could spread; it does not say organisms consciously calculate kinship or that all family help is genetic. **Reciprocal altruism** can evolve among non-kin when partners meet repeatedly, benefits exceed costs, and cheaters can be detected or excluded. Parent and offspring share interests but are not genetically identical, producing **parent-offspring conflict** over investment while leaving extensive scope for attachment and care.

## 4. Social cognition and cooperation

**Theory of mind** supports inferences about others' beliefs, knowledge, intentions, and likely actions. Social-contract reasoning tracks whether someone accepted a benefit without paying the required cost, supporting **cheater detection** and partner choice. Coalition psychology tracks alliances, loyalty, status, and threat; group markers can change quickly because the underlying problem is identifying who is aligned with whom, not memorizing one permanent set of groups.`,
    bodyMedium: `# Evolution, mating, kinship, and cooperation

## Core evolutionary framework

Evolutionary explanations ask what recurrent problem a mechanism helped solve; proximate explanations describe how hormones, learning, development, and immediate goals implement it. A complete account identifies the ancestral problem, the relevant cue, the mechanism's decision rule, and the predicted cost-benefit tradeoff.

## 1. Foundations

Natural selection requires heritable variation and systematic differences in reproductive outcomes. Adaptations show evidence of functional design for recurrent past problems; exaptations were selected for another role, and by-products accompany other features. The EEA is a distribution of relevant ancestral conditions, varying by mechanism rather than a mythical single savanna. Gene-culture coevolution is illustrated by dairying: a cultural practice changed selection on adult lactose digestion, while social learning enabled the practice to persist.

A calorie-seeking mechanism illustrates the framework: energy-dense taste cues once predicted scarce nutritional value, learning calibrates which foods carry those cues, and modern marketing can amplify them in environments of abundance.

## 2. Mate selection and sexual strategies

Parental investment includes resources that increase one offspring's prospects at a cost to other reproductive opportunities. Where minimum investment differs, average choice and competition may differ, but human biparental care, cooperative breeding, ecology, autonomy, and norms complicate simple predictions. Sexual selection includes both mate choice and competition within a sex; dimorphism offers one imperfect historical clue.

Short- and long-term strategies are conditional allocations rather than fixed personality boxes. Expected relationship duration, mate availability, personal condition, parental opportunities, and ecological risk can shift the payoff from immediate mating effort toward durable bonding and investment.

## 3. Kinship and altruism

Hamilton's rule rB > C is an accounting condition: helping is favored when relatedness times the recipient's benefit exceeds the helper's cost. It predicts patterns across relevant contexts, not conscious arithmetic. Kin recognition can use cues such as co-residence, maternal association, or social labels, which can misfire; adoption and friendship show that care is not reducible to genetic relatedness.

Reciprocal altruism is favored by repeated interaction, memory, partner choice, and sanctions. Reputation and indirect reciprocity broaden cooperation, but cultural institutions can transform incentives. Parent-offspring conflict predicts disagreement over timing or allocation of investment because relatedness to current and potential siblings differs; it does not predict constant hostility.

## 4. Social cognition and cooperation

Theory of mind permits prediction from another person's false belief rather than from reality. Performance varies with language, executive demands, age, and social experience. In social-contract Wason tasks, people often detect a benefit-taker who failed to pay a cost more readily than an abstract rule violation. That pattern is consistent with specialized cheater detection, but controls for familiarity and pragmatic clarity are needed.

Humans form coalitions, track loyalty, and categorize groups quickly. Minimal-group experiments show how easily alliance markers can be assigned, while cross-cutting identities show that the mind can update which coalition is currently relevant.`,
    bodyLong: `# Evolution, mating, kinship, and cooperation

## Mapping evolutionary mechanisms

Evolutionary psychology links ultimate questions about selection history with proximate questions about mechanism and development. For any mechanism, map five elements: the recurrent adaptive problem, the cues available to the organism, the decision rule, the regulated behavior, and the fitness tradeoff. Conditional mechanisms can produce different behavior across environments because they are designed to use local information.

## 1. Foundations

Natural selection operates when variants are heritable and affect reproductive success in a given environment. Adaptations are products of past selection, so a feature can persist after its environment changes, and a useful current effect can be incidental. Researchers seek converging evidence: comparative patterns, cross-cultural and within-cultural variation, developmental timing, experimental responses to predicted cues, physiological or computational design, and—in some cases—genetic evidence.

The EEA means the recurring selection-relevant inputs over many generations. Different systems had different relevant environments: pathogen defense depends on contamination patterns, while social exchange depends on repeated interaction. Human evolution also continued through the Holocene. Gene-culture coevolution rejects a genes-versus-culture split: cooking, pastoralism, agriculture, and institutions altered environments; evolved imitation, teaching, and norm psychology influenced cultural transmission.

*Case:* If a food preference is strongest only after repeated advertising, that weakens a simple invariant-adaptation claim but may fit an evolved learning bias interacting with a constructed market environment. The design must compare these models rather than choosing one by label.

## 2. Mate selection and sexual strategies

Sexual selection arises from competition for mating opportunities and mate choice. Parental investment theory predicts strategic consequences from costs that increase offspring survival while limiting alternative reproduction. Yet humans have flexible pair bonds, paternal investment, alloparents, concealed ovulation, and strong institutions. Operational sex ratio, mortality, resource control, contraception, and gender norms can reshape behavior.

Sexual dimorphism in size or ornamentation can suggest historical mating competition when interpreted comparatively, but it cannot identify one modern preference. Short-term strategies may prioritize immediate mating opportunities; long-term strategies may prioritize compatibility, investment, and reliability. Individuals can shift with age, condition, opportunity, risk, and goals. Means do not diagnose a person: distributions overlap substantially, and within-sex variation may exceed an average between-sex difference.

Mate-choice mechanisms should track variables that changed ancestral reproductive payoffs: fertility cues, health, status, resource prospects, genetic quality, compatibility, fidelity, and willingness to invest. The weight placed on each cue changes with mating strategy, local ecology, and the chooser's own condition.

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

## A map of the mind's recurrent problems

Emotion and cognition coordinate responses to recurring problems: avoiding predators and pathogens, protecting relationships, bargaining over costs, acquiring status, learning social information, allocating effort across the life course, and responding when modern inputs exceed ancestral ranges.

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
      "Untimed Session 1 practice. Select one answer for multiple choice; answer the short item in one sentence. Every item requires reasoning from a scenario.",
    problems: [
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "A woman can spend one afternoon helping either her full sister raise two additional surviving children or an unrelated neighbor raise three. The personal cost is equivalent to one expected child. Using Hamilton's rule, which choice has the larger inclusive-fitness benefit? A) Help the sister, because 0.5 × 2 exceeds the cost while 0 × 3 does not. B) Help the neighbor, because three is greater than two regardless of relatedness. C) Both choices have identical inclusive-fitness effects. D) Hamilton's rule predicts never helping anyone.",
        correctAnswer:
          "A) Help the sister, because 0.5 × 2 exceeds the cost while 0 × 3 does not.",
        explanation:
          "Hamilton's rule weights the recipient's reproductive benefit by relatedness, so the sister's benefit contributes to inclusive fitness while the unrelated neighbor's does not through kin selection.",
      },
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "In a fishing community, siblings share food more often than strangers, but unrelated partners also exchange food repeatedly and stop helping defectors. Explain how inclusive fitness and reciprocal altruism generate distinct predictions for this pattern. (Answer in one sentence.)",
        correctAnswer:
          "Inclusive fitness predicts help according to relatedness-weighted benefits, whereas reciprocal altruism predicts conditional help among repeatedly interacting non-kin who can detect or exclude defectors.",
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
          "Nora watches Liam hide fruit in a blue box. After Liam leaves, Maya moves it to a red box. Where should Nora predict Liam will search first if she represents his false belief? A) The blue box. B) The red box. C) Whichever box Nora personally prefers. D) She cannot predict an action from another person's belief.",
        correctAnswer:
          "A) The blue box.",
        explanation:
          "Theory of mind allows Nora to predict Liam's action from what Liam believes, even though Nora knows the fruit is now elsewhere.",
      },
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "A social-media app supplies unpredictable likes and an endless stream of novel clips. Which mechanism best explains why this design can hold attention far longer than ordinary face-to-face feedback? A) Variable rewards and exaggerated novelty act as supernormal social-information cues. B) Humans evolved specifically to use smartphones. C) The behavior follows Hamilton's rule. D) The app eliminates all reward learning.",
        correctAnswer:
          "A) Variable rewards and exaggerated novelty act as supernormal social-information cues.",
        explanation:
          "Modern platforms can magnify novelty and social-reward cues beyond the intensity and frequency typical of ancestral interaction.",
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
      "Timed. 15 minutes. Select one answer for multiple choice; answer the short item in one sentence. Keystrokes are screened for AI use.",
    problems: [
      {
        topicSlug: "evolutionary-foundations",
        prompt:
          "In a population where infant survival depends heavily on years of care from both parents, which shift does parental-investment theory predict relative to an ecology where one parent can raise offspring alone? A) Greater returns to long-term pair bonding and mate qualities that predict reliable investment. B) Elimination of mate choice. C) Universal preference for short-term mating. D) No relationship between offspring needs and mating strategy.",
        correctAnswer:
          "A) Greater returns to long-term pair bonding and mate qualities that predict reliable investment.",
        explanation:
          "When offspring survival depends on sustained biparental care, reliable long-term investment becomes more valuable in mate choice.",
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
          "Under a life-history model, what allocation shift is predicted when childhood cues reliably indicate high mortality and an unpredictable future? (Answer in one sentence.)",
        correctAnswer:
          "The model predicts relatively earlier allocation toward mating and immediate returns rather than delayed growth, maintenance, and future-oriented investment.",
        explanation:
          "Life-history theory predicts allocation tradeoffs between present and future reproductive opportunities.",
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
      "Timed cumulative final. 25 minutes. Select one answer for multiple choice; answer the short item in one sentence. Keystrokes are screened for AI use.",
    problems: [
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "During a group project, one member repeatedly takes credit while contributing little. Which predicted function of anger best fits the offended members' response? A) Anger increases pressure on the exploiter to place greater weight on their welfare and contributions. B) Anger calculates genetic relatedness. C) Anger primarily prevents pathogen exposure. D) Anger signals that the group should ignore the unfair allocation.",
        correctAnswer:
          "A) Anger increases pressure on the exploiter to place greater weight on their welfare and contributions.",
        explanation:
          "The recalibrational theory treats anger as a bargaining response to another person's insufficient valuation of one's welfare.",
      },
      {
        topicSlug: "minds-development-mismatch",
        prompt:
          "Use the smoke-detector principle to explain why a threat system may produce many false alarms when missing one real danger is extremely costly. (Answer in one sentence.)",
        correctAnswer:
          "When the cost of missing a real threat greatly exceeds the cost of a false alarm, selection favors a low activation threshold that produces frequent protective false alarms.",
        explanation:
          "The smoke-detector principle predicts biased error management when false negatives are costlier than false positives.",
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

This primer prepares you for the **Nano Evolutionary Psychology** diagnostic. It is ungraded, fresh on every attempt, and asks you to apply mechanisms rather than recite terms.

## It tests application, not memorization

A question gives a short behavioral or research scene. Identify the operative evolutionary mechanism, locate the cue that activates it, and derive the predicted tradeoff or behavior.

## What the questions reward

- **Applying mechanisms** — use kin selection, reciprocity, parental investment, sexual selection, life-history allocation, error management, or mismatch to solve the case.
- **Using evidence from the scene** — point to the detail in the situation that supports your answer, rather than answering from a general impression.
- **Deriving predictions** — explain what the mechanism predicts when relatedness, costs, benefits, mating opportunities, threat levels, or future uncertainty changes.

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

- **Analysis** maps a recurrent adaptive problem to cues, decision rules, and behavioral outputs.
- **Inference** distinguishes what a cross-cultural pattern suggests from what it proves.
- **Evaluation** asks whether matched controls discriminate adaptation from familiarity or learning.
- **Deduction** identifies what follows from a conditional model such as Hamilton's rule once its assumptions are supplied.
- **Induction** identifies how repeated ecological patterns can shape conditional psychological strategies.

## A recurring trap: things that move together

Most wrong answers apply the wrong mechanism or ignore a decisive variable in the scenario. Focus on relatedness, repeated interaction, investment asymmetry, error costs, ecological predictability, pathogen cues, alliance structure, or ancestral-modern mismatch.

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
