import { Router, type IRouter } from "express";
import { assignmentsTable, attemptsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { localUser } from "../middlewares/access";

const router: IRouter = Router();

async function certificateResult(): Promise<{
  complete: boolean;
  passed: boolean;
  overallPercent: number;
}> {
  const assignments = await db
    .select({ id: assignmentsTable.id })
    .from(assignmentsTable);
  if (assignments.length === 0) {
    return { complete: false, passed: false, overallPercent: 0 };
  }

  const submitted = await db
    .select({
      assignmentId: attemptsTable.assignmentId,
      scorePercent: attemptsTable.scorePercent,
    })
    .from(attemptsTable)
    .where(eq(attemptsTable.status, "submitted"));
  const bestScores = new Map<number, number>();
  for (const attempt of submitted) {
    bestScores.set(
      attempt.assignmentId,
      Math.max(bestScores.get(attempt.assignmentId) ?? 0, attempt.scorePercent ?? 0),
    );
  }
  const complete = assignments.every((assignment) =>
    bestScores.has(assignment.id),
  );
  const overallPercent = complete
    ? assignments.reduce(
        (sum, assignment) => sum + (bestScores.get(assignment.id) ?? 0),
        0,
      ) / assignments.length
    : 0;
  return {
    complete,
    passed: complete && overallPercent >= 60,
    overallPercent,
  };
}

function certificateName(
  displayName: string | null,
  email: string | null,
): string {
  const name = displayName?.trim() || email?.split("@")[0]?.trim();
  return name || "COURSE LEARNER";
}

async function renderCertificate(name: string): Promise<Buffer> {
  const { default: PDFDocument } = await import("pdfkit");
  const doc = new PDFDocument({
    size: "LETTER",
    layout: "landscape",
    margin: 54,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width;
  const height = doc.page.height;
  doc
    .lineWidth(3)
    .strokeColor("#18294a")
    .rect(28, 28, width - 56, height - 56)
    .stroke();
  doc
    .lineWidth(1)
    .strokeColor("#b29b63")
    .rect(38, 38, width - 76, height - 76)
    .stroke();

  doc
    .fillColor("#18294a")
    .font("Times-Bold")
    .fontSize(34)
    .text("CERTIFICATE OF COMPLETION", 70, 105, {
      width: width - 140,
      align: "center",
    });
  doc
    .fillColor("#5f6775")
    .font("Helvetica")
    .fontSize(15)
    .text("Nano Evolutionary Psychology", 70, 160, {
      width: width - 140,
      align: "center",
    });
  doc
    .fillColor("#18294a")
    .font("Times-Bold")
    .fontSize(29)
    .text(name.toUpperCase(), 80, 230, {
      width: width - 160,
      align: "center",
    });
  doc
    .fillColor("#222222")
    .font("Helvetica")
    .fontSize(20)
    .text("HAS COMPLETED EVOLUTIONARY PSYCHOLOGY LEVEL 1.", 80, 295, {
      width: width - 160,
      align: "center",
    });
  doc
    .fillColor("#5f6775")
    .fontSize(12)
    .text(
      `Issued ${new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date())}`,
      80,
      380,
      { width: width - 160, align: "center" },
    );
  doc.end();
  return completed;
}

router.get("/certificate/download", async (req, res): Promise<void> => {
  const user = await localUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with Google to download your certificate." });
    return;
  }
  const result = await certificateResult();
  if (!result.complete) {
    res.status(403).json({ error: "Complete all four assignments first." });
    return;
  }
  if (!result.passed) {
    res.status(403).json({
      error: `Certificate status: Not passed. A coursework average of at least 60% is required; current average is ${Math.round(result.overallPercent)}%.`,
    });
    return;
  }

  const name = certificateName(user.displayName, user.email);
  const pdf = await renderCertificate(name);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="evolutionary-psychology-level-1-certificate.pdf"',
  );
  res.setHeader("Content-Length", String(pdf.length));
  res.send(pdf);
});

export default router;