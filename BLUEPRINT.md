# Nano Evolutionary Psychology — App Blueprint

A complete architectural blueprint for the Nano Evolutionary Psychology 4–6 hour course. This document is the single reference for what the app does, how it is wired, and the contracts between pieces. For day-to-day commands and gotchas see `replit.md`.

---

## 1. Product summary

Nano Evolutionary Psychology is a self-paced, single-user, no-login web course designed for approximately 4–6 hours of study. Its eight topic areas are **evolution by natural selection; adaptation and evolutionary inference; sexual selection and mating; parental investment and families; kin selection and inclusive fitness; cooperation and reciprocity; social cognition, status, and groups; and culture, development, and critical methods**. Throughout, evolutionary accounts are presented as testable, probabilistic hypotheses rather than deterministic explanations of individual behavior. Students read AI-rewritten lecture notes at three lengths, ask an AI tutor scoped to the section they are reading, drill on adaptive practice problems, and submit two homework sets, a course test, and a final that are AI-graded and AI-detection-screened.

Two diagnostic primers accompany the topic areas. The subject primer asks students to identify an evolutionary hypothesis, its predictions, plausible alternatives, and evidential limits in concrete behavioral cases rather than assuming every trait is an adaptation. The general primer applies analysis, inference, evaluation, deduction, and induction in a domain-neutral format, with particular attention to what observations can support and why a pattern alone does not establish an evolutionary cause.

The product surface is two deployable artifacts in one pnpm monorepo:

| Artifact | Slug | Role |
| --- | --- | --- |
| `@workspace/api-server` | `api-server` | Express 5 API mounted at `/api`. Owns the DB, OpenAI calls, AI detection, grading, diagnostics. |
| `@workspace/qr-course` | `qr-course` | Student-facing React + Vite app. The actual course. |

Shared contracts live in `lib/`:

- `lib/api-spec` — OpenAPI source of truth.
- `lib/api-zod` — generated Zod validators (used by the server).
- `lib/api-client-react` — generated React Query hooks (used by `qr-course`).
- `lib/db` — Drizzle schema + db client.

---

## 2. Domain model (Postgres + Drizzle)

Source: `lib/db/src/schema/course.ts`.

```
topics ──< lectures              (one topic, one lecture per length)
topics ──< problems              (problems tagged to a topic for analytics)
assignments ──< problems         (homework / test / midterm / final)
assignments ──< attempts ──< answers
                                ↑ per-answer keystroke trace + AI scores
practice_sessions ──< practice_problems ──< practice_attempts
                                            ↑ adaptive difficulty session
```

Notable columns:

- `lectures.body` / `body_medium` / `body_long` — the Short / Medium / Long toggle is three pre-baked LLM rewrites of the same lecture.
- `answers.{keystrokeCount,eraseCount,bulkInsertCount,longestBulkInsertChars,rewriteSegments,durationMs}` — the **diachronic trace**. Captured client-side from the textarea and submitted with the answer.
- `answers.{aiScore,aiFlagged,diachronicScore,diachronicFlagged,detectionRationale}` — frozen detection outcome at submission time.
- `practice_sessions.difficulty` (1–4, double) — adapts session-by-session based on streaks / accuracy.

Push schema with `pnpm --filter @workspace/db run push`.

---

## 3. API surface (OpenAPI-first)

Source: `lib/api-spec/openapi.yaml`. **Never** hand-edit `lib/api-zod/src/generated/*` or `lib/api-client-react/src/generated/*` — change the spec and run `pnpm --filter @workspace/api-spec run codegen`.

Tag groups and what they own:

| Tag | Endpoints | Purpose |
| --- | --- | --- |
| `course` | `GET /course/overview`, `GET /course/weeks/{n}`, `GET /course/lectures/{id}` | Read the static course tree. Lectures return Short/Medium/Long bodies. |
| `tutor` | `POST /tutor/ask` (SSE), `GET /tutor/suggestions/{lectureId}` | Streaming AI tutor scoped to a lecture section. Suggestions are pre-generated starter questions. |
| `practice` | `POST /practice/sessions`, `POST /practice/sessions/{id}/next`, `POST /practice/sessions/{id}/attempts` | Adaptive practice: server generates the next problem, scoring it adjusts session `difficulty`. |
| `assignments` | `GET /assignments`, `GET /assignments/{id}`, `POST /assignments/{id}/attempt`, `PUT /assignments/{id}/attempts/{aid}/answers/{pid}`, `POST /assignments/{id}/attempts/{aid}/submit` | Homework / test flow. Submit endpoint triggers AI grade + detection per answer. |
| `analytics` | `GET /analytics/summary`, `GET /analytics/topics`, `GET /analytics/activity` | KPIs, topic mastery, recent activity. |
| `detection` | `POST /detection/scan` | Run AI + diachronic detection on an arbitrary text + trace. Used directly by the diagnostics page. |
| `diagnostics` | `GET /diagnostics/system`, `POST /diagnostics/synthetic-run`, `POST /diagnostics/quality-control`, `POST /diagnostics/expand-lectures`, `POST /diagnostics/reset` | Self-tests and seed maintenance. See §6. |

The submit endpoint's response schema (`AttemptResult`) bundles `score / total / percent / perProblem[] / detection[]` so the UI can render the AI-grade + detection verdict in one round-trip.

---

## 4. Server architecture

### 4.1 Layout

```
artifacts/api-server/src/
├── routes/
│   ├── course.ts          read-only course tree
│   ├── tutor.ts           SSE chat against a lecture section
│   ├── practice.ts        adaptive session lifecycle
│   ├── assignments.ts     attempt + grade + detect on submit
│   ├── analytics.ts       summary / topic mastery / activity
│   ├── detection.ts       /detection/scan passthrough
│   ├── diagnostics.ts     three diagnostics + seed maintenance
│   ├── health.ts          /healthz
│   └── index.ts           router mount
└── lib/
    ├── ai.ts              OpenAI client (Replit AI Integrations proxy)
    ├── detection.ts       GPTZero + heuristic + diachronic scoring
    ├── grading.ts         AI-graded answer with rationale
    └── logger.ts          singleton pino logger (req.log in routes)
```

### 4.2 Conventions

- **Validation:** every handler parses input with `safeParse` from `@workspace/api-zod` and re-`parse`s outputs before sending. Never trust the request body, never trust your own response.
- **Logging:** `req.log.info(...)` inside routes; singleton `logger` everywhere else. **Never** `console.log` in server code.
- **OpenAI:** all model calls go through `lib/ai.ts` (`chatText`, `chatJson`, `chatStream`, `FAST_MODEL`). The Replit AI proxy means no API key is needed in dev or prod.
- **Errors:** thrown errors bubble to a global error handler that logs and returns `{ error: string }` with the right status. Detection failures are **non-fatal** — they return `null` and the caller falls back.

---

## 5. AI detection — `artifacts/api-server/src/lib/detection.ts`

Detection is the project's signature feature. It runs **two independent functions** and bundles their outputs into one `DetectionOutcome`.

### 5.1 Detection Function 1 — Static AI detection (GPTZero, with fallback)

Question answered: *"Was this text written by an LLM?"*

Pipeline:

1. **`gptzeroAiScore(text)`** — calls `POST https://api.gptzero.me/v2/predict/text` with `x-api-key: $GPTZERO_API_KEY`. Reads `documents[0].class_probabilities.ai` (plus half-weight of `mixed`), falls back to `completely_generated_prob`. Returns `null` on missing key, network failure, malformed response, or text shorter than 40 chars.
2. **`heuristicAiScore(text)`** — local zero-dependency scorer. Penalises long average sentence length plus presence of LLM tells (`delve`, `tapestry`, `leverag(e|ing)`, `in conclusion`, `it is important to note`, `plays a crucial/vital/pivotal role`, etc.). Used as anchor + fallback.
3. **`llmAiScore(text)`** — secondary fallback. Asks the OpenAI proxy in JSON-only mode for `{"probability": 0..1}`. Used only when GPTZero is unavailable.

Blend (`detect()`):

```
if GPTZero responded:           aiScore = 0.85 * gptzero + 0.15 * heuristic
elif LLM scorer responded:      aiScore = 0.60 * llm     + 0.40 * heuristic
else:                           aiScore = heuristic
```

`aiFlagged = aiScore >= 0.55`.

### 5.2 Detection Function 2 — Diachronic detection (keystroke pattern)

Question answered: *"Did the student paste AI output and reword it to sound human?"*

This is the novel part: even if the final text passes GPTZero (because the student edited the wording), the **act of producing it** looks nothing like organic typing.

`diachronicScore(text, trace)` reads a `TraceInput` captured by the client:

```
{ keystrokeCount, eraseCount, bulkInsertCount?, longestBulkInsertChars?,
  rewriteSegments?, durationMs }
```

It adds penalty points for:

| Signal | Penalty | Why |
| --- | --- | --- |
| `longestBulkInsertChars > 40` *or* `longestBulkInsertChars / textLen > 0.4` | +0.50 | One paste covers most of the answer. |
| `bulkInsertCount >= 2 && longestBulkInsert > 25` | +0.15 | Multiple paste events. |
| `keystrokeCount / textLen < 0.6` with `textLen > 30` | +0.30 | Far fewer keys pressed than characters of output — paste-like. |
| `charsPerSecond > 12` with `textLen > 30` | +0.20 | Sustained typing speed that does not resemble normal human composition. |
| `longestBulkInsert > 30 && rewriteSegments >= 2` | +0.15 | Big paste followed by reword passes — the giveaway pattern. |

Clamped to `[0, 1]`. `diachronicFlagged = diachronicScore >= 0.55`.

### 5.3 Combined outcome

`detect()` returns:

```ts
{
  aiScore, aiFlagged,
  diachronicScore, diachronicFlagged,
  rationale: string  // human-readable explanation incl. GPTZero %
}
```

This outcome is persisted on `answers` at submit time and surfaces in the assignment results UI plus the diagnostics page.

---

## 6. Diagnostics surface

Three routes, one page. The page lives at `artifacts/qr-course/src/pages/Diagnostics.tsx` and is linked from the student app. **These are operator tools, not student-facing features.**

### 6.1 `GET /api/diagnostics/system` — system self-test

Runs a strict ordered checklist and returns `{ ok, generatedAt, steps[] }`. Each step has `{ name, ok, ms, detail?, error? }`. The student page renders one row per step with pass/fail and timing.

Steps:

1. **Environment** — `DATABASE_URL` present.
2. **Database** — `SELECT 1` round-trip.
3. **Database** — course content is seeded (≥2 topics, ≥1 lecture / assignment / problem).
4. **OpenAI** — fast-model chat completion returns non-empty text.
5. **OpenAI** — JSON mode returns `{ ok: true }`.
6. **Detection** — heuristic+scoring pipeline returns numbers for a benign sentence.
7. **AI detection** — pasted-style LLM-tell text **flags** as AI.
8. **GPTZero** — if `GPTZERO_API_KEY` is set, the real API responds and gives a non-null score.

If any step fails the page shows the red row and the raw error string from the server — that's the debugging surface.

### 6.2 `POST /api/diagnostics/synthetic-run` — end-to-end synthetic student

Simulates a real student session against the live DB and reports each leg pass/fail/timing. Useful when refactoring the practice loop or grading pipeline. Stages roughly:

1. Create a practice session for a known topic.
2. Pull the first problem (`/practice/sessions/{id}/next`).
3. Submit a wrong answer, then a right one — confirm difficulty adjusts and accuracy persists.
4. Create an assignment attempt, answer each problem, submit, and verify `AttemptResult` returns full `perProblem[]` + `detection[]`.
5. Hit analytics endpoints and confirm the new attempt is reflected.

### 6.3 `POST /api/diagnostics/quality-control` — OpenAI answer-key legitimacy check

Independently re-derives the answer to a sample of course problems and verifies each seeded answer key is legitimate. Returns `{ ok, generatedAt, steps[] }` like the other diagnostics. Stages:

1. Collect every assignment problem joined to its assignment, grouped by day, and sample up to 12 with a guaranteed per-day quota so every day is covered even if its problem count is uneven.
2. For each sampled problem, run a **two-phase** check: (a) the LLM independently re-derives an answer from the prompt **alone**, blind to the seeded key, so the verdict can't just rubber-stamp the key; (b) a second LLM call judges whether the seeded key is legitimate given the prompt + the independent answer, using the grader's semantic-equivalence philosophy — accepting any correct on-topic short answer and flagging only genuinely defective keys (wrong, off-topic, self-contradictory, contradicted on substance, or ungradeable). Returns `{ legitimate, confidence, rationale }`; malformed verdicts are treated as failures, not passes.
3. A legitimate key passes its step; a flagged key fails its step with the model's rationale. A final summary step reports the legitimate/flagged tally.

### 6.4 Supporting routes (not in the diagnostics UI)

- `POST /api/diagnostics/expand-lectures` — generates `body_medium` / `body_long` for lectures that are missing them. Idempotent.
- `POST /api/diagnostics/reset` — wipes attempts / answers / practice for a clean demo. **Does not** drop course content.

---

## 7. Student app — `@workspace/qr-course`

React + Vite + Tailwind. Routes:

| Route | Page | What it does |
| --- | --- | --- |
| `/` | `Dashboard` | Assignments progress + Course Schedule + Recent Activity |
| `/weeks/:weekNumber` | `WeekView` | List of week's lectures and assignments |
| `/lectures/:lectureId` | `LectureView` | Lecture body + Short/Medium/Long toggle + right-rail tutor / practice |
| `/practice/topic/:topicId` | `TopicPractice` | Adaptive single-topic drill |
| `/assignments` | `Assignments` | All homework / tests / midterm / final |
| `/assignments/:id` | `AssignmentRunner` | Take + review an assignment; shows AI grade + detection per answer |
| `/analytics` | `Analytics` | KPIs, topic mastery table, recent activity |
| `/diagnostics` | `Diagnostics` | Operator self-test UI (see §6) |

All server data goes through the **generated** React Query hooks from `@workspace/api-client-react`. No fetch logic should be hand-written in components.

### 7.1 Diachronic trace capture

The answer `<textarea>` is wrapped in a hook (lives in the assignment runner / topic practice) that:

- Counts every `keydown` (excluding modifier-only) into `keystrokeCount`.
- Increments `eraseCount` on Backspace/Delete.
- On every `input` event, compares the new value to the previous: if the diff inserted ≥4 chars in one tick, that's a "bulk insert" — increment `bulkInsertCount` and update `longestBulkInsertChars`.
- Detects a "rewrite segment" when characters are erased mid-string and then replaced with new ones (not at the tail).
- Stamps `durationMs` = (submit time − first focus time).

The trace is included in the answer `PUT` body and on `POST submit`, then stored verbatim on `answers` so detection is reproducible.

---

## 8. README contract

`replit.md` is the always-loaded project README. It contains:

1. **Run & Operate** — every command needed in day-to-day work.
2. **Required env / secrets** — `DATABASE_URL`, `GPTZERO_API_KEY`, `SESSION_SECRET`; OpenAI via Replit AI Integrations proxy (no key).
3. **Stack** — exact runtime versions and tools.
4. **Where things live** — pointer map: OpenAPI spec, generated hooks, DB schema, route files, detection lib, AI lib, pages.
5. **Product** — 6-bullet description of what the student actually does.
6. **Architecture decisions** — non-obvious choices: contract-first API, single composite logger, GPTZero failure is non-fatal.
7. **User preferences** — be direct, no preamble.
8. **Gotchas** — don't edit generated files; don't rename `info.title`; restart workflows, don't `pnpm dev` at root.

If you change anything in this blueprint, update `replit.md` to match — they are the long-form and short-form views of the same truth.

---

## 9. End-to-end request example

A student submits Homework 1.1. The full path:

1. Browser: `qr-course/src/pages/AssignmentRunner.tsx` calls the generated `useSubmitAttempt()` hook with `{ traces: { [problemId]: TraceInput } }`.
2. Generated client: `POST /api/assignments/{id}/attempts/{aid}/submit`, validated against `SubmitAttemptBody` Zod schema.
3. Express route (`routes/assignments.ts`):
   - Loads `attempt` + `answers` + `problems` from Drizzle.
   - For each answer: calls `gradeAnswer(problem, answer)` (OpenAI JSON mode, returns `{ correct, rationale }`) **and** `detect(answer.text, trace)` in parallel.
   - Writes `correct`, `aiScore`, `aiFlagged`, `diachronicScore`, `diachronicFlagged`, `detectionRationale` back onto each answer row.
   - Updates `attempts.status = "submitted"`, computes `scorePercent`.
4. Returns `AttemptResult` validated against the generated Zod schema.
5. Browser: `AssignmentRunner` renders per-problem cards with the AI grade rationale + a detection chip (`Human-written response · confidence 94%` or `AI-detected · 91%`).

Every layer in that chain (spec → server zod → server logic → client hook → client zod) is generated or validated from the same `openapi.yaml`. Don't introduce a parallel path.
