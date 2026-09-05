---
name: Course design mandates
description: Non-obvious user mandates about the AI course UX that look removable but are intentional and must be preserved.
---

# Course design mandates

These are explicit user requirements that a future agent might wrongly "clean up"
because they seem unwarranted for a plain-language, no-math course. They are intentional.

## Math keyboard is mandatory everywhere
A symbol palette (`MathKeyboard`) must be present on EVERY freeform input — answer
inputs (practice, practice-assignments, real assignments) AND the AI tutor chat
boxes — even though the course subject is non-technical and "doesn't seem to warrant it."

**Why:** Direct user mandate ("MAKE SURE THE MATH KEYBOARD IS PRESENT, INCLUDING WITH
AI TUTOR, EVEN IF THE SUBJECT-MATTER DOES NOT SEEM TO WARRANT IT").
**How to apply:** Do not remove the keyboard from any input. Math-keyboard insertions
must count as `keystrokeCount` (not bulk-insert) in the keystroke
trace, or legitimate symbol use false-flags the AI-authorship detector.

## Questions must require operational reasoning, never recitation
ALL questions — homeworks, unit test, final, practice assignments, AND the adaptive
topic drill — must pose a specific concrete scenario and require reasoning. Freeform
answers may be one sentence when the format distribution calls for it, but never a
one-word/single-term/"yes-no" response. Never ask learners to define or recite an
abstract formulation. Every question must also be fully answerable from the reading
shown to the learner: never test a named method, formula, coefficient, distinction,
term, or fact unless the reading explicitly teaches it by that name. Normally omit
formal principle names and test the relationship in plain language. If a name is
unavoidable, define the complete principle inside the question itself.

**Why:** Repeated, emphatic user mandate — answers must be "hard to share" and prove
operational understanding, not memorization. The adaptive drill previously generated
single-word concept-ID questions and was the one place that violated this.
**How to apply:** Any new question-generation prompt must forbid definitions/one-word
answers and demand a concrete case + reasoned answer. Supply the assigned reading to
the generator, require an exact supporting quote from it, reject unverifiable quotes,
and make questions state any additional numbers or relationships they need.

## Multiple-choice questions use selection controls
Multiple-choice questions must display their options as radio-style selections. Never
show a freeform text box or tell a learner to copy, paste, type, or "enter the full
option." Never run GPTZero or any other authorship detector on a multiple-choice
selection. Each multiple-choice question must have exactly two or three options,
never four; prefer three unless the distinction is genuinely binary.

**Why:** Requiring transcription makes a familiar question format idiosyncratic and
creates unnecessary confusion; detector scoring is categorically invalid because the
selected text was supplied by the course rather than authored by the learner. Four
options create needless reading load and reward test-gaming over learning the material.
**How to apply:** Keep the scenario and options visually separate, save the selected
option in the answer snapshot, exclude it from detection results, clear any detector
fields, and preserve text inputs/detection only for genuinely freeform questions.
Apply the same behavior to graded and practice versions.

## Every graded attempt uses fresh questions
Homework, tests, and finals must generate a new scenario-reasoning question set for each new attempt; seeded questions are concept templates only and must never be shown as the graded set.

**Why:** Repeating the fixed seed bank makes retries predictable and defeats the course's requirement for fresh assessment.
**How to apply:** Persist generated variants per attempt so refresh keeps work stable, exclude all prior/source prompts from generation, and fail visibly rather than falling back to a canned item.

## Practice answers follow the exact format mix and are graded one at a time
Across each rolling 50-question bank: 60% are multiple choice, 30% require exactly
one sentence, 8% require 1–3 sentences, and 2% require one paragraph of 5–7
sentences. Never require the learner to finish an entire set before receiving a result.

**Why:** The owner explicitly requires this exact 60/30/8/2 distribution, very few
long answers, and immediate question-level grading rather than a submit-all workflow.
**How to apply:** Put a Submit button on every practice question. After that click,
show that question's integer percentage and specific feedback directly beneath it;
leave every unsubmitted question editable and independently submittable.

## Answer-length diagnostics must match the active course
Operator and synthetic diagnostics are part of the course format, not exempt test fixtures. If the course caps answers at one paragraph, no diagnostic may generate, require, or advertise a multi-paragraph proof.

**Why:** A retained five-paragraph diagnostic contradicted a one-paragraph course mandate and failed because the model correctly resisted the obsolete format.

**How to apply:** Sweep diagnostic API prompts, validators, OpenAPI summaries, and visible labels whenever answer-length rules change; verify generation, exact persistence, grading, and cleanup with a real request.

## Lectures open with highlights and lead directly to coursework
Every lecture must offer a concise bullet-point Highlights preset immediately left of Short, and Highlights is the default reading view. Every lecture must also link directly to its related assignments.

**Why:** Most learners, including the owner, want the essential points without reading the full lecture before beginning applicable work.
**How to apply:** Preserve Short, Medium, Long, and custom versions. In Highlights, render each plain, unnumbered section label exactly once with unnumbered, self-contained bullet points beneath it—never numbers, sentence fragments, or a heading repeated per bullet. Keep assignment links visible below the reading.
