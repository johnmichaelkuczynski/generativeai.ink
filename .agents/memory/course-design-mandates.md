---
name: Course design mandates (Data Detective)
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
topic drill — must pose a specific concrete scenario and require a multi-sentence
reasoned answer. Never a one-word/single-term/"yes-no" answer, never "define X" or
"recite the abstract formulation from the text."

**Why:** Repeated, emphatic user mandate — answers must be "hard to share" and prove
operational understanding, not memorization. The adaptive drill previously generated
single-word concept-ID questions and was the one place that violated this.
**How to apply:** Any new question-generation prompt must forbid definitions/one-word
answers and demand a concrete case + reasoned answer. The semantic `gradeAnswer` grader
already handles reasoned answers, so longer answers are safe to grade.

## Answer-length diagnostics must match the active course
Operator and synthetic diagnostics are part of the course format, not exempt test fixtures. If the course caps answers at one paragraph, no diagnostic may generate, require, or advertise a multi-paragraph proof.

**Why:** A retained five-paragraph diagnostic contradicted a one-paragraph course mandate and failed because the model correctly resisted the obsolete format.

**How to apply:** Sweep diagnostic API prompts, validators, OpenAPI summaries, and visible labels whenever answer-length rules change; verify generation, exact persistence, grading, and cleanup with a real request.
