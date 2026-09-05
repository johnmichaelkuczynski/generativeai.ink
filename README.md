# 🧠 Nano Evolutionary Psychology

<div align="center">

### From evolutionary principles to careful explanations of behavior.

<strong>A rigorous, self-paced, AI-powered introduction to evolutionary approaches to human behavior for adult researchers, professionals, and students entering the field.</strong>

<br />
<br />

[![Course](https://img.shields.io/badge/course-4%E2%80%936%20hours-2563EB?style=for-the-badge&logo=bookstack&logoColor=white)](#-the-learning-journey)
[![Lessons](https://img.shields.io/badge/lessons-short%20%7C%20medium%20%7C%20long-7C3AED?style=for-the-badge&logo=readme&logoColor=white)](#-learn-at-your-pace)
[![Access](https://img.shields.io/badge/access-no%20account%20required-059669?style=for-the-badge&logo=checkmarx&logoColor=white)](#-built-for-real-learning)
[![Stack](https://img.shields.io/badge/stack-react%20%2B%20typescript-F97316?style=for-the-badge&logo=react&logoColor=white)](#-under-the-hood)

</div>

<br />

> **Evolutionary psychology asks how evolutionary processes may help explain psychological traits and behavior.**
> It requires testable predictions, comparison with alternative explanations, and care not to treat probabilistic patterns as fixed or universal.

---

## ✨ Why this course?

Nano Evolutionary Psychology is a **4–6 hour web course taught, tutored, drilled, and graded by AI**. It turns core evolutionary-psychology questions into a structured learning experience with concrete cases, adaptive practice, grounded tutoring, and built-in academic-integrity screening.

No adaptation-only storytelling and no definition-only quizzes. Every assessment asks the learner to reason from evidence, compare explanations, and state conclusions cautiously.

## 🧭 The learning journey

| Topic area | What you will work through | The question it answers |
| --- | --- | --- |
| 🟦 **Evolution by natural selection** | Variation, inheritance, differential reproduction, fitness, and levels of explanation. | **What would selection predict, and what would it not establish?** |
| 🟪 **Adaptation and evolutionary inference** | Adaptations, by-products, noise, hypothesis formation, alternatives, and standards of evidence. | **How can an evolutionary account be tested rather than assumed?** |
| 🟩 **Sexual selection and mating** | Mate preferences, competition, trade-offs, and variation across people and contexts. | **Which predictions follow from sexual selection, and where are their limits?** |
| 🟨 **Parental investment and families** | Investment, parent–offspring conflict, life-history trade-offs, and caregiving ecology. | **How might costs, benefits, and environments shape family behavior?** |
| 🟧 **Kin selection and inclusive fitness** | Relatedness, indirect fitness, kin recognition, and conditional helping. | **When might helping relatives be favored?** |
| 🟥 **Cooperation and reciprocity** | Reciprocal altruism, partner choice, punishment, reputation, and collective action. | **How can cooperation persist when defection is possible?** |
| 🟫 **Social cognition, status, and groups** | Coalitions, hierarchy, social learning, conflict, and intergroup psychology. | **How might social environments shape flexible strategies?** |
| ⬛ **Culture, development, and critical methods** | Developmental calibration, culture–gene interactions, cross-cultural evidence, replication, and ethical interpretation. | **How should evolutionary claims be evaluated responsibly?** |

### The reasoning primers

Two ungraded primers support careful reasoning:

- 🧪 **How to reason about evolutionary-psychology cases** — identify the hypothesis, predicted evidence, alternatives, and limits in a concrete behavioral scenario.
- 🧠 **Core reasoning skills** — practice analysis, inference, evaluation, deduction, and induction in a domain-neutral format.

---

## 🎯 Built for real learning

<table>
<tr>
<td width="50%">

### 📚 Learn at your pace

Every lecture is available in **Short, Medium, or Long** depth while keeping the same examples and learning objectives.

</td>
<td width="50%">

### 💬 Ask a grounded tutor

The section-scoped AI tutor streams answers grounded in the exact lecture passage on screen.

</td>
</tr>
<tr>
<td width="50%">

### 🧩 Practice adaptively

Generated scenario problems adjust difficulty based on recent answers, so practice responds to the learner.

</td>
<td width="50%">

### ✍️ Reason, do not recite

Homework, tests, practice, and diagnostics require multi-step application to realistic production cases.

</td>
</tr>
<tr>
<td width="50%">

### 🏁 See what you know

Two homework sets, a timed course test, and a cumulative final receive semantic grading, per-problem results, and written rationale.

</td>
<td width="50%">

### 🛡️ Protect assessment integrity

Every submission is checked by both a static text detector and diachronic keystroke-pattern analysis.

</td>
</tr>
</table>

## 📦 What is included

- **A 4–6 hour course** organized around eight evolutionary psychology topic areas
- **Three lecture depths**: Short, Medium, and Long
- **Section-scoped AI tutoring** with streamed responses
- **Adaptive topic practice** with persistent difficulty
- **Four graded checkpoints**: two homework sets, a course test, and a final
- **Ungraded diagnostic checks** across multiple formats, lengths, and course phases
- **Live analytics** for KPIs, topic mastery, activity, and weak areas
- **Free PDF and TXT course downloads** with no sign-in
- **A built-in product walkthrough video**

## 👥 Designed for

| Audience | Takeaway |
| --- | --- |
| 🔬 **Researchers and professionals entering evolutionary psychology** | A foundational but substantial introduction completed in approximately 4–6 hours. |
| 🧠 **Students and interdisciplinary teams** | A shared language for evolutionary hypotheses, behavioral evidence, alternatives, and uncertainty. |
| 🎓 **Instructors and curriculum designers** | A working example of AI-taught, AI-graded coursework with integrity controls. |
| 🔎 **Academic-integrity researchers** | A live demonstration of layered authorship screening in an educational product. |

## ⚙️ Under the hood

- **Contract-first API** — OpenAPI is the source of truth; React Query hooks and Zod validators are generated from the same contract.
- **Streaming tutor** — Server-Sent Events deliver section-scoped tutor responses token by token.
- **Adaptive practice engine** — Per-session difficulty persists and changes after correct and incorrect attempts.
- **Two-layer detection** — GPTZero-backed text detection is blended with structural signals, while keystroke analysis evaluates paste-and-rewrite behavior and sustained input patterns.
- **Diagnostic self-tests** — Operator controls verify the database, course seed, model completion, JSON mode, detection pipeline, practice loop, grading loop, and analytics.
- **Auto-reseeded curriculum** — A content marker detects a subject change and replaces stale course material transactionally.

## 🧑‍💻 Run it locally

This is a pnpm workspace with separate artifacts for the course, API server, and walkthrough video.

```bash
pnpm install
pnpm run typecheck
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/qr-course run dev
```

The course and API require the environment variables documented in the deployment setup. Secrets are never committed to the repository.

## 🌈 The promise

> **Learn to test an evolutionary explanation, not merely tell an evolutionary story.**

Nano Evolutionary Psychology gives learners a practical reasoning sequence: **observe variation → propose alternatives → derive predictions → compare evidence → qualify conclusions**.

<div align="center">

### Ready to move from a plausible account to a testable, carefully qualified explanation?

**Start with the course. Build the habit of asking what the evidence actually proves.**

</div>