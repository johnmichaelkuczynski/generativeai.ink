---
name: Authoritative answer submission
description: The invariant that prevents long assignment answers from being graded as empty or as an older prefix.
---

Assignment grading must treat the complete answer snapshot carried by the submit request as authoritative. Persist that exact snapshot before loading answers. Each question is graded once at submission time; final completion only aggregates the persisted percentage grades and must never call the grader or detector again.

**Why:** Fire-and-forget saves can finish out of order, while re-running external grading or detection at the final button can fail after the learner already received every individual grade, blocking completion with a gateway error.

**How to apply:** Keep full final answers in the submit payload, validate coverage, persist first, and store each immediate integer score with the answer. The final endpoint must be database-only. Verify that a stored nonbinary score (for example, 87%) is returned unchanged.