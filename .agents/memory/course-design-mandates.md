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
abstract formulation.

**Why:** Repeated, emphatic user mandate — answers must be "hard to share" and prove
operational understanding, not memorization. The adaptive drill previously generated
single-word concept-ID questions and was the one place that violated this.
**How to apply:** Any new question-generation prompt must forbid definitions/one-word
answers and demand a concrete case + reasoned answer. The semantic `gradeAnswer` grader
already handles reasoned answers, so longer answers are safe to grade.

## Multiple-choice questions use selection controls
Multiple-choice questions must display their options as radio-style selections. Never
show a freeform text box or tell a learner to copy, paste, type, or "enter the full
option."

**Why:** Requiring transcription makes a familiar question format idiosyncratic and
creates unnecessary confusion about how the learner should respond.
**How to apply:** Keep the scenario and options visually separate, save the selected
option in the answer snapshot, and preserve text inputs only for genuinely freeform
questions. Apply the same behavior to graded and practice versions.

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
