import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import {
  db,
  topicsTable,
  lecturesTable,
  assignmentsTable,
  attemptsTable,
} from "@workspace/db";
import {
  GetCourseOverviewResponse,
  GetWeekResponse,
  GetLectureResponse,
  ListTopicsResponse,
  RewriteLectureBody,
  GenerateLectureExamplesBody,
} from "@workspace/api-zod";
import { chatText } from "../lib/ai";

const router: IRouter = Router();

const WEEK_TITLES: Record<number, { title: string; summary: string }> = {
  1: {
    title: "Nano Evolutionary Psychology: 4–6 Hour Certification",
    summary:
      "A rigorous 4–6 hour, two-session certification covering foundations; mate selection and sexual strategies; kinship and altruism; social cognition and cooperation; emotion and motivation; cognitive adaptations; evolutionary developmental psychology; and pathology and mismatch.",
  },
};

async function buildWeek(weekNumber: number) {
  const lectures = await db
    .select({
      id: lecturesTable.id,
      title: lecturesTable.title,
      topicId: lecturesTable.topicId,
    })
    .from(lecturesTable)
    .where(eq(lecturesTable.weekNumber, weekNumber))
    .orderBy(asc(lecturesTable.id));

  const assignments = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.weekNumber, weekNumber))
    .orderBy(asc(assignmentsTable.position));

  const assignmentSummaries = await Promise.all(
    assignments.map(async (a) => {
      const counts = await db.execute(
        sql`select count(*)::int as n from problems where assignment_id = ${a.id}`,
      );
      const n = (counts.rows[0] as { n?: number } | undefined)?.n ?? 0;
      const attempts = await db
        .select()
        .from(attemptsTable)
        .where(eq(attemptsTable.assignmentId, a.id))
        .orderBy(asc(attemptsTable.id));
      const submitted = attempts.filter((x) => x.status === "submitted");
      const inProgress = attempts.find((x) => x.status === "in_progress");
      const best = submitted.reduce(
        (best, x) =>
          x.scorePercent != null && x.scorePercent > best ? x.scorePercent : best,
        -1,
      );
      const status: "not_started" | "in_progress" | "submitted" = inProgress
        ? "in_progress"
        : submitted.length > 0
        ? "submitted"
        : "not_started";
      const last = attempts[attempts.length - 1];
      return {
        id: a.id,
        kind: a.kind as "homework" | "test" | "midterm" | "final",
        title: a.title,
        weekNumber: a.weekNumber,
        problemCount: n,
        isTimed: a.isTimed,
        timeLimitMinutes: a.timeLimitMinutes,
        status,
        bestScore: best < 0 ? null : best,
        lastAttemptId: last?.id ?? null,
      };
    }),
  );

  const meta = WEEK_TITLES[weekNumber] ?? {
    title: `Week ${weekNumber}`,
    summary: "",
  };

  return {
    weekNumber,
    title: meta.title,
    summary: meta.summary,
    lectures,
    assignments: assignmentSummaries,
  };
}

router.get("/course/overview", async (_req, res) => {
  const weeks = await Promise.all([1].map(buildWeek));
  const assignmentsTotal = weeks.reduce((s, w) => s + w.assignments.length, 0);
  const assignmentsCompleted = weeks.reduce(
    (s, w) => s + w.assignments.filter((a) => a.status === "submitted").length,
    0,
  );
  const practiceCountRow = await db.execute(
    sql`select count(*)::int as n from practice_attempts`,
  );
  const practiceCount =
    (practiceCountRow.rows[0] as { n?: number } | undefined)?.n ?? 0;

  res.json(
    GetCourseOverviewResponse.parse({
      title: "Nano Evolutionary Psychology",
      weeks,
      totals: { assignmentsCompleted, assignmentsTotal, practiceCount },
    }),
  );
});

router.get("/course/weeks/:weekNumber", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.weekNumber)
    ? req.params.weekNumber[0]
    : req.params.weekNumber;
  const weekNumber = parseInt(raw ?? "", 10);
  if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 1) {
    res.status(400).json({ error: "invalid weekNumber" });
    return;
  }
  const week = await buildWeek(weekNumber);
  res.json(GetWeekResponse.parse(week));
});

router.get("/course/lectures/:lectureId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.lectureId)
    ? req.params.lectureId[0]
    : req.params.lectureId;
  const lectureId = parseInt(raw ?? "", 10);
  if (!Number.isFinite(lectureId)) {
    res.status(400).json({ error: "invalid lectureId" });
    return;
  }
  const [lecture] = await db
    .select()
    .from(lecturesTable)
    .where(eq(lecturesTable.id, lectureId));
  if (!lecture) {
    res.status(404).json({ error: "lecture not found" });
    return;
  }
  res.json(GetLectureResponse.parse(lecture));
});

function parseLectureId(req: { params: { lectureId?: string | string[] } }): number | null {
  const raw = Array.isArray(req.params.lectureId)
    ? req.params.lectureId[0]
    : req.params.lectureId;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const lectureId = parseInt(raw, 10);
  return Number.isFinite(lectureId) ? lectureId : null;
}

// Rewrite a lecture from the student's own instruction (more examples on a
// point, a clearer illustration of a principle, shorter sentences, etc.). The
// result is persisted as the lecture's custom version so it survives reloads
// and can be refined further.
router.post(
  "/course/lectures/:lectureId/rewrite",
  async (req, res): Promise<void> => {
    const lectureId = parseLectureId(req);
    if (lectureId === null) {
      res.status(400).json({ error: "invalid lectureId" });
      return;
    }
    const parsed = RewriteLectureBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const instruction = parsed.data.instruction.trim();
    const baseLevel = parsed.data.baseLevel ?? "short";

    const [lecture] = await db
      .select()
      .from(lecturesTable)
      .where(eq(lecturesTable.id, lectureId));
    if (!lecture) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }

    // Pick the version to rewrite from. Fall back to the short body whenever the
    // requested base hasn't been generated yet.
    const base =
      baseLevel === "long"
        ? lecture.bodyLong
        : baseLevel === "medium"
          ? lecture.bodyMedium
          : baseLevel === "custom"
            ? lecture.bodyCustom
            : lecture.body;
    const sourceBody = (base && base.trim().length > 0 ? base : lecture.body).trim();

    const sys =
      "You are an Evolutionary Psychology lecturer revising your own lecture at a student's request. " +
      "You are given the CURRENT lecture and ONE instruction from the student about how to revise it. " +
      "Apply the instruction faithfully. ABSOLUTE RULES, no exceptions:\n" +
      "1. KEEP every concept, claim, and learning objective from the current lecture. Never drop material or change what the lecture teaches — only adjust how it is presented per the instruction.\n" +
      "2. Preserve the existing examples; you may add to or clarify them, but do not silently replace them with different ones unless the instruction explicitly asks you to.\n" +
      "3. Keep headings and section order intact. You may add sub-sections (e.g. extra examples) when the instruction calls for it.\n" +
      "4. Stay scientifically cautious and accurate. Distinguish hypotheses from evidence, preserve alternative explanations, and avoid deterministic or justificatory claims. Do not invent facts, citations, or quotations.\n" +
      "5. Use clear Markdown. Preserve any code, JSON, or API examples accurately.\n" +
      "6. Return ONLY the rewritten Markdown lecture body — no preface, no commentary, no surrounding code fences.";
    const user =
      `LECTURE TITLE: ${lecture.title}\n\n` +
      `STUDENT INSTRUCTION:\n"""\n${instruction}\n"""\n\n` +
      `CURRENT LECTURE:\n"""\n${sourceBody}\n"""`;

    let rewritten = "";
    try {
      rewritten = (await chatText(sys, user)).trim();
    } catch {
      res
        .status(502)
        .json({ error: "The rewrite service is unavailable right now. Please try again in a moment." });
      return;
    }
    // Guard against an empty / truncated response clobbering the lecture.
    if (rewritten.length < Math.min(200, sourceBody.length * 0.4)) {
      res.status(502).json({
        error: "The model returned an unusable rewrite — please rephrase your instruction and try again.",
      });
      return;
    }

    const [updated] = await db
      .update(lecturesTable)
      .set({ bodyCustom: rewritten, customInstruction: instruction })
      .where(eq(lecturesTable.id, lectureId))
      .returning();
    res.json(GetLectureResponse.parse(updated));
  },
);

// Discard a lecture's custom rewrite and revert to the original.
router.delete(
  "/course/lectures/:lectureId/rewrite",
  async (req, res): Promise<void> => {
    const lectureId = parseLectureId(req);
    if (lectureId === null) {
      res.status(400).json({ error: "invalid lectureId" });
      return;
    }
    const [updated] = await db
      .update(lecturesTable)
      .set({ bodyCustom: null, customInstruction: null })
      .where(eq(lecturesTable.id, lectureId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }
    res.json(GetLectureResponse.parse(updated));
  },
);

// Generate (and cache) the "with lots of examples" variant for a given base
// length. Keeps the same content and structure as that length, but adds at
// least one vivid illustration to every point.
router.post(
  "/course/lectures/:lectureId/examples",
  async (req, res): Promise<void> => {
    const lectureId = parseLectureId(req);
    if (lectureId === null) {
      res.status(400).json({ error: "invalid lectureId" });
      return;
    }
    const parsed = GenerateLectureExamplesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const level = parsed.data.level;

    const [lecture] = await db
      .select()
      .from(lecturesTable)
      .where(eq(lecturesTable.id, lectureId));
    if (!lecture) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }

    const examplesColumn =
      level === "long"
        ? "bodyLongExamples"
        : level === "medium"
          ? "bodyMediumExamples"
          : "bodyShortExamples";

    // Already generated for this length — return as-is so toggling is instant.
    if (lecture[examplesColumn] && lecture[examplesColumn]!.trim().length > 0) {
      res.json(GetLectureResponse.parse(lecture));
      return;
    }

    const base =
      level === "long"
        ? lecture.bodyLong
        : level === "medium"
          ? lecture.bodyMedium
          : lecture.body;
    const sourceBody = (base && base.trim().length > 0 ? base : lecture.body).trim();

    const sys =
      "You are an Evolutionary Psychology lecturer adding illustrations to your own lecture. " +
      "You are given the CURRENT lecture. Return the SAME lecture, unchanged in what it teaches, but with vivid illustrations added. ABSOLUTE RULES, no exceptions:\n" +
      "1. KEEP every concept, claim, heading, section, and learning objective exactly as they are, in the same order. Do not remove, reorder, or rewrite the existing explanation — only ADD to it.\n" +
      "2. For EVERY distinct point the lecture makes, add AT LEAST ONE concrete, vivid illustration that makes the point easy to picture: a short scenario, a real-to-life case sketch, an everyday analogy, or a worked example. Keep illustrations tasteful and age-appropriate — never graphic or sensational.\n" +
      "3. Set off each illustration so it reads as an example (e.g. a short *Example:* sentence or a brief italicized vignette) rather than blending into the original text.\n" +
      "4. Stay scientifically cautious and accurate. Distinguish hypotheses from evidence and avoid deterministic or justificatory claims. Do not invent facts, statistics, citations, or quotations; keep examples illustrative rather than presenting them as documented cases.\n" +
      "5. Use clear Markdown. Preserve any code, JSON, or API examples accurately.\n" +
      "6. Return ONLY the augmented Markdown lecture body — no preface, no commentary, no surrounding code fences.";
    const user =
      `LECTURE TITLE: ${lecture.title}\n\n` +
      `CURRENT LECTURE:\n"""\n${sourceBody}\n"""`;

    let augmented = "";
    try {
      augmented = (await chatText(sys, user)).trim();
    } catch {
      res.status(502).json({
        error: "The example service is unavailable right now. Please try again in a moment.",
      });
      return;
    }
    // Guard against an empty / truncated response. The augmented version should
    // be at least as long as the source it expands on.
    if (augmented.length < Math.max(200, sourceBody.length * 0.9)) {
      res.status(502).json({
        error: "The model returned an unusable result — please try again in a moment.",
      });
      return;
    }

    const [updated] = await db
      .update(lecturesTable)
      .set({ [examplesColumn]: augmented })
      .where(eq(lecturesTable.id, lectureId))
      .returning();
    res.json(GetLectureResponse.parse(updated));
  },
);

router.get("/course/topics", async (_req, res) => {
  const rows = await db
    .select()
    .from(topicsTable)
    .orderBy(asc(topicsTable.position));
  res.json(ListTopicsResponse.parse(rows));
});

// --- Public course PDF download (no auth, no AI) ---
// Short lecture for every topic, plus a sampler of homework problems and
// exam questions, compiled into a single downloadable PDF.
function mdToPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[a-z]*\n?/g, "").trim(),
    )
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
}

async function loadCourseReaderData() {
  const topics = await db
    .select()
    .from(topicsTable)
    .orderBy(asc(topicsTable.position));

  const lectures = await db
    .select({
      topicId: lecturesTable.topicId,
      title: lecturesTable.title,
      body: lecturesTable.body,
    })
    .from(lecturesTable)
    .orderBy(asc(lecturesTable.id));
  const lectureByTopic = new Map(lectures.map((l) => [l.topicId, l]));

  const problemRows = await db.execute(sql`
    select p.prompt, p.topic_id, a.kind, a.title as assignment_title, p.position
    from problems p
    join assignments a on a.id = p.assignment_id
    order by a.kind, p.topic_id, p.position
  `);
  const allProblems = problemRows.rows as Array<{
    prompt: string;
    topic_id: number;
    kind: string;
    assignment_title: string;
    position: number;
  }>;
  // Two homework problems per topic, and up to ten exam questions.
  const homework: typeof allProblems = [];
  const perTopic = new Map<number, number>();
  for (const p of allProblems.filter((x) => x.kind === "homework")) {
    const n = perTopic.get(p.topic_id) ?? 0;
    if (n < 2) {
      homework.push(p);
      perTopic.set(p.topic_id, n + 1);
    }
  }
  const exam = allProblems
    .filter((x) => x.kind === "test" || x.kind === "midterm" || x.kind === "final")
    .filter((_, i) => i % 2 === 0)
    .slice(0, 10);

  return { topics, lectureByTopic, homework, exam };
}

// --- Public course TXT download (no auth, no AI) ---
router.get("/course/download-txt", async (_req, res) => {
  try {
    const { topics, lectureByTopic, homework, exam } =
      await loadCourseReaderData();

    const lines: string[] = [];
    const rule = "=".repeat(72);
    lines.push("NANO EVOLUTIONARY PSYCHOLOGY");
    lines.push("Evidence, Adaptation, and Human Behavior — Course Reader");
    lines.push(
      "Both sessions of the 4–6 hour certification, with sample homework problems and exam questions.",
    );
    lines.push(rule, "", "TOPICS COVERED", "");
    for (const t of topics) lines.push(`  ${t.slug}  ${t.title}`);
    lines.push("", rule);

    for (const t of topics) {
      const lec = lectureByTopic.get(t.id);
      if (!lec) continue;
      lines.push("", lec.title.toUpperCase(), "-".repeat(lec.title.length), "");
      lines.push(mdToPlain(lec.body));
      lines.push("", rule);
    }

    if (homework.length) {
      lines.push("", "SAMPLE HOMEWORK PROBLEMS", "");
      homework.forEach((p, i) => {
        lines.push(`${i + 1}. [${p.assignment_title}]`, mdToPlain(p.prompt), "");
      });
      lines.push(rule);
    }
    if (exam.length) {
      lines.push("", "SAMPLE EXAM QUESTIONS", "");
      exam.forEach((p, i) => {
        lines.push(`${i + 1}. [${p.assignment_title}]`, mdToPlain(p.prompt), "");
      });
      lines.push(rule);
    }
    lines.push("", "End of course reader.");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="nano-evolutionary-psychology-course.txt"',
    );
    res.send(lines.join("\n"));
  } catch (err) {
    console.error("TXT export error:", err);
    res.status(500).json({ error: "Failed to generate course text file" });
  }
});

router.get("/course/download-pdf", async (_req, res) => {
  try {
    const { default: PDFDocument } = await import("pdfkit");

    const { topics, lectureByTopic, homework, exam } =
      await loadCourseReaderData();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="nano-evolutionary-psychology-course.pdf"',
    );

    const doc = new PDFDocument({ margin: 54, bufferPages: true });
    doc.pipe(res);

    // Title page
    doc.font("Times-Bold").fontSize(30).text("Nano Evolutionary Psychology", { align: "center" });
    doc.moveDown(0.5);
    doc
      .font("Times-Roman")
      .fontSize(14)
      .text("Evidence, Adaptation, and Human Behavior — Course Reader", { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor("#555555")
      .text(
        "Both sessions of the 4–6 hour certification, with sample homework problems and exam questions.",
        { align: "center" },
      );
    doc.fillColor("black");
    doc.moveDown(2);
    doc.font("Times-Bold").fontSize(16).text("Topics Covered");
    doc.moveDown(0.5);
    doc.font("Times-Roman").fontSize(12);
    for (const t of topics) {
      doc.text(`${t.slug}  ${t.title}`, { indent: 12 });
      doc.moveDown(0.2);
    }

    // Lectures
    for (const t of topics) {
      const lec = lectureByTopic.get(t.id);
      if (!lec) continue;
      doc.addPage();
      doc.font("Times-Bold").fontSize(18).text(`Topic ${t.slug}: ${t.title}`);
      doc.moveDown(0.6);
      doc.font("Times-Roman").fontSize(11.5);
      for (const para of mdToPlain(lec.body).split(/\n{2,}/)) {
        doc.text(para.replace(/\n/g, " "), { align: "justify" });
        doc.moveDown(0.6);
      }
    }

    // Homework sampler
    doc.addPage();
    doc.font("Times-Bold").fontSize(18).text("Practice Homework (Sampler)");
    doc.moveDown(0.6);
    doc.font("Times-Roman").fontSize(11.5);
    let hn = 1;
    for (const p of homework) {
      const topic = topics.find((t) => t.id === p.topic_id);
      doc.font("Times-Bold").text(`Problem ${hn}${topic ? ` (Topic ${topic.slug})` : ""}`);
      doc.font("Times-Roman").text(mdToPlain(p.prompt), { align: "justify" });
      doc.moveDown(0.8);
      hn++;
    }

    // Exam sampler
    doc.addPage();
    doc.font("Times-Bold").fontSize(18).text("Sample Exam Questions");
    doc.moveDown(0.6);
    doc.font("Times-Roman").fontSize(11.5);
    let en = 1;
    for (const p of exam) {
      doc.font("Times-Bold").text(`Question ${en} (${p.assignment_title})`);
      doc.font("Times-Roman").text(mdToPlain(p.prompt), { align: "justify" });
      doc.moveDown(0.8);
      en++;
    }

    doc
      .moveDown(1.5)
      .fontSize(10)
      .fillColor("#555555")
      .text(
        "Answers, AI tutoring, adaptive practice, and graded assignments are available in the online Nano Evolutionary Psychology course.",
      );

    doc.end();
  } catch (err) {
    console.error("Course PDF error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate course PDF" });
    } else {
      res.end();
    }
  }
});

export default router;
