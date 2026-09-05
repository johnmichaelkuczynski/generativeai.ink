import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";

// Key/value bookkeeping for the seeder. Stores the content version of the
// currently-seeded curriculum so that a republished build whose seed content
// changed can detect the mismatch on boot and re-seed automatically, instead
// of relying solely on the presence of a marker topic.
export const seedMetaTable = pgTable("seed_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const topicsTable = pgTable("topics", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  weekNumber: integer("week_number").notNull(),
  blurb: text("blurb"),
  position: integer("position").notNull().default(0),
});

export const lecturesTable = pgTable("lectures", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topicsTable.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  bodyMedium: text("body_medium"),
  bodyLong: text("body_long"),
  bodyCustom: text("body_custom"),
  customInstruction: text("custom_instruction"),
  // Cached "with lots of examples" variants — one per base length. Each keeps
  // the same content/structure of its length but adds at least one vivid
  // illustration per point. Null until the reader toggles examples on.
  bodyShortExamples: text("body_short_examples"),
  bodyMediumExamples: text("body_medium_examples"),
  bodyLongExamples: text("body_long_examples"),
});

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // homework | test | midterm | final
  title: text("title").notNull(),
  weekNumber: integer("week_number").notNull(),
  position: integer("position").notNull().default(0),
  isTimed: boolean("is_timed").notNull().default(false),
  timeLimitMinutes: integer("time_limit_minutes"),
  instructions: text("instructions"),
});

export const problemsTable = pgTable("problems", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignmentsTable.id, { onDelete: "cascade" }),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topicsTable.id),
  position: integer("position").notNull(),
  prompt: text("prompt").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
  hint: text("hint"),
});

export const attemptsTable = pgTable("attempts", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignmentsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("in_progress"), // in_progress | submitted
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  scorePercent: doublePrecision("score_percent"),
});

export const attemptProblemVariantsTable = pgTable("attempt_problem_variants", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id")
    .notNull()
    .references(() => attemptsTable.id, { onDelete: "cascade" }),
  sourceProblemId: integer("source_problem_id")
    .notNull()
    .references(() => problemsTable.id, { onDelete: "cascade" }),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topicsTable.id),
  position: integer("position").notNull(),
  prompt: text("prompt").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
});

export const answersTable = pgTable("answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id")
    .notNull()
    .references(() => attemptsTable.id, { onDelete: "cascade" }),
  problemId: integer("problem_id")
    .notNull()
    .references(() => problemsTable.id, { onDelete: "cascade" }),
  answer: text("answer").notNull().default(""),
  correct: boolean("correct"),
  scorePercent: doublePrecision("score_percent"),
  keystrokeCount: integer("keystroke_count").notNull().default(0),
  eraseCount: integer("erase_count").notNull().default(0),
  bulkInsertCount: integer("bulk_insert_count").notNull().default(0),
  longestBulkInsertChars: integer("longest_bulk_insert_chars").notNull().default(0),
  rewriteSegments: integer("rewrite_segments").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  aiScore: doublePrecision("ai_score"),
  aiFlagged: boolean("ai_flagged"),
  diachronicScore: doublePrecision("diachronic_score"),
  diachronicFlagged: boolean("diachronic_flagged"),
  detectionRationale: text("detection_rationale"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practiceSessionsTable = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  weekNumber: integer("week_number"),
  topicId: integer("topic_id"),
  // When set, this session is an infinite practice version of a specific graded
  // assignment (homework/test/midterm/final) rather than open topic practice.
  assignmentId: integer("assignment_id").references(() => assignmentsTable.id, {
    onDelete: "cascade",
  }),
  mode: text("mode").notNull().default("topic"), // topic | assignment
  tutorEnabled: boolean("tutor_enabled").notNull().default(false),
  focusOnWeaknesses: boolean("focus_on_weaknesses").notNull().default(true),
  difficulty: doublePrecision("difficulty").notNull().default(2.0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practiceProblemsTable = pgTable("practice_problems", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessionsTable.id, { onDelete: "cascade" }),
  topicId: integer("topic_id").notNull(),
  prompt: text("prompt").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: doublePrecision("difficulty").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practiceAttemptsTable = pgTable("practice_attempts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessionsTable.id, { onDelete: "cascade" }),
  problemId: integer("problem_id")
    .notNull()
    .references(() => practiceProblemsTable.id, { onDelete: "cascade" }),
  topicId: integer("topic_id").notNull(),
  answer: text("answer").notNull(),
  correct: boolean("correct").notNull(),
  difficulty: doublePrecision("difficulty").notNull(),
  trace: jsonb("trace"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Diagnostic reasoning assessments (embedded program-level instruments).
// Two instruments — `subject` (Developmental Psychology subject reasoning) and
// `general` (general reasoning) — each offered at four phases (before, third,
// twothirds, after) in three formats, with freshly generated, never-repeating
// items every attempt. Ungraded: takeable anytime, never affects the grade.
// ---------------------------------------------------------------------------

export const diagnosticAssessmentsTable = pgTable("diagnostic_assessments", {
  id: serial("id").primaryKey(),
  instrument: text("instrument").notNull(), // subject | general
  phase: text("phase").notNull(), // before | third | twothirds | after
  // Answer format of this version of the test: mcq (options only), hybrid
  // (options + a short written justification), or written (short written
  // justification, no options). Each (instrument, phase) is offered in all
  // three formats as separate selectable assessments.
  format: text("format").notNull().default("mcq"), // mcq | hybrid | written
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  instructions: text("instructions").notNull(),
  position: integer("position").notNull().default(0),
});

export const diagnosticItemsTable = pgTable("diagnostic_items", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => diagnosticAssessmentsTable.id, { onDelete: "cascade" }),
  // Null for the seeded "template" items (the canonical question bank used for
  // the first take and as the generation template). For a retake, fresh items
  // are generated per attempt and tagged with that attempt's id so every
  // retake gets different questions of the same kind. These cascade-delete
  // with their attempt.
  attemptId: integer("attempt_id").references(
    () => diagnosticAttemptsTable.id,
    { onDelete: "cascade" },
  ),
  position: integer("position").notNull(),
  type: text("type").notNull(), // dilemma | mcq
  prompt: text("prompt").notNull(),
  // Public payload sent to the client: for mcq -> { options: string[] };
  // for dilemma -> { decisionOptions: string[], considerations: string[] }.
  payload: jsonb("payload").notNull(),
  // Hidden scoring key, never sent to the client: for mcq ->
  // { correctIndex, skillArea }; for dilemma -> { stages: string[], rankCount }.
  scoring: jsonb("scoring").notNull(),
});

export const diagnosticAttemptsTable = pgTable("diagnostic_attempts", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => diagnosticAssessmentsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("in_progress"), // in_progress | submitted
  passed: boolean("passed"),
  feedback: text("feedback"),
  responses: jsonb("responses"),
  scoreSummary: jsonb("score_summary"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

// Per-item responses for a submitted attempt. The full response set is also
// stored as JSON on the attempt for convenience, but this normalized table
// keeps one row per answered item so responses can be queried per item.
// Rows cascade-delete with their parent attempt (and with the item).
export const diagnosticResponsesTable = pgTable("diagnostic_responses", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id")
    .notNull()
    .references(() => diagnosticAttemptsTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => diagnosticItemsTable.id, { onDelete: "cascade" }),
  selectedIndex: integer("selected_index"), // mcq/hybrid — chosen option index
  writtenAnswer: text("written_answer"), // hybrid/written — free-text answer
  decisionIndex: integer("decision_index"), // legacy dilemma — chosen decision index
  ratings: jsonb("ratings"), // legacy dilemma — importance rating per consideration
  ranking: jsonb("ranking"), // legacy dilemma — consideration indices, most-important first
  isCorrect: boolean("is_correct"), // graded correctness (null if unanswered)
});
