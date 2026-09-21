import { Router, type IRouter } from "express";
import { assignmentsTable, attemptsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetCertificateStatusResponse } from "@workspace/api-zod";
import { createHash } from "node:crypto";
import { localUser } from "../middlewares/access";

const router: IRouter = Router();
const REQUIRED_PERCENT = 70;

async function certificateResult(): Promise<{
  complete: boolean;
  passed: boolean;
  overallPercent: number;
  completedAt: Date | null;
}> {
  const assignments = await db
    .select({ id: assignmentsTable.id })
    .from(assignmentsTable);
  if (assignments.length === 0) {
    return {
      complete: false,
      passed: false,
      overallPercent: 0,
      completedAt: null,
    };
  }

  const submitted = await db
    .select({
      assignmentId: attemptsTable.assignmentId,
      scorePercent: attemptsTable.scorePercent,
      submittedAt: attemptsTable.submittedAt,
    })
    .from(attemptsTable)
    .where(eq(attemptsTable.status, "submitted"));
  const bestScores = new Map<number, number>();
  const firstSubmissions = new Map<number, Date>();
  for (const attempt of submitted) {
    bestScores.set(
      attempt.assignmentId,
      Math.max(bestScores.get(attempt.assignmentId) ?? 0, attempt.scorePercent ?? 0),
    );
    if (attempt.submittedAt) {
      const existing = firstSubmissions.get(attempt.assignmentId);
      if (!existing || attempt.submittedAt < existing) {
        firstSubmissions.set(attempt.assignmentId, attempt.submittedAt);
      }
    }
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
  const completionDates = assignments
    .map((assignment) => firstSubmissions.get(assignment.id))
    .filter((date): date is Date => Boolean(date));
  const completedAt =
    complete && completionDates.length === assignments.length
      ? new Date(Math.max(...completionDates.map((date) => date.getTime())))
      : null;
  return {
    complete,
    passed: complete && overallPercent >= REQUIRED_PERCENT,
    overallPercent,
    completedAt,
  };
}

function certificateName(
  displayName: string | null,
  email: string | null,
): string {
  const name = displayName?.trim() || email?.split("@")[0]?.trim();
  return name || "COURSE LEARNER";
}

function certificateNumber(userId: number, email: string | null): string {
  const checksum = createHash("sha256")
    .update(`zhi-evolutionary-psychology-series-1:${userId}:${email ?? ""}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `ZHI-EPS1-${String(userId).padStart(6, "0")}-${checksum}`;
}

function issuedDate(completedAt: Date | null): string {
  return (completedAt ?? new Date()).toISOString().slice(0, 10);
}

function formattedDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

async function renderCertificate(input: {
  name: string;
  certificateNumber: string;
  issuedDate: string;
  overallPercent: number;
}): Promise<Buffer> {
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
    .fillColor("#b08a3e")
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("ZHI SYSTEMS", 70, 78, {
      width: width - 140,
      align: "center",
      characterSpacing: 2.5,
    });
  doc
    .fillColor("#18294a")
    .font("Times-Bold")
    .fontSize(34)
    .text("CERTIFICATE OF COMPLETION", 70, 118, {
      width: width - 140,
      align: "center",
    });
  doc
    .fillColor("#5f6775")
    .font("Helvetica")
    .fontSize(12)
    .text("THIS CERTIFICATE IS AWARDED TO", 70, 178, {
      width: width - 140,
      align: "center",
      characterSpacing: 1.2,
    });
  doc
    .fillColor("#18294a")
    .font("Times-Bold")
    .fontSize(29)
    .text(input.name.toUpperCase(), 80, 218, {
      width: width - 160,
      align: "center",
    });
  doc
    .fillColor("#222222")
    .font("Helvetica")
    .fontSize(18)
    .text("IN EVOLUTIONARY PSYCHOLOGY SERIES 1", 80, 282, {
      width: width - 160,
      align: "center",
    });

  doc
    .lineWidth(2)
    .strokeColor("#b08a3e")
    .circle(width / 2, 372, 34)
    .stroke();
  doc
    .fillColor("#b08a3e")
    .font("Times-Bold")
    .fontSize(15)
    .text("ZHI", width / 2 - 30, 357, { width: 60, align: "center" });
  doc
    .fillColor("#5f6775")
    .font("Helvetica")
    .fontSize(8)
    .text("SYSTEMS", width / 2 - 30, 376, {
      width: 60,
      align: "center",
      characterSpacing: 0.8,
    });

  doc
    .fillColor("#5f6775")
    .font("Helvetica")
    .fontSize(12)
    .text(
      `Issued ${formattedDate(input.issuedDate)}  •  Final grade ${Math.round(input.overallPercent)}%`,
      80,
      430,
      { width: width - 160, align: "center" },
    );
  doc
    .fontSize(9)
    .text(`Certificate No. ${input.certificateNumber}`, 80, 458, {
      width: width - 160,
      align: "center",
    });
  doc.end();
  return completed;
}

router.get("/certificate/status", async (req, res) => {
  const [user, result] = await Promise.all([
    localUser(req),
    certificateResult(),
  ]);
  const eligible = Boolean(user && result.passed);
  res.json(
    GetCertificateStatusResponse.parse({
      signedIn: Boolean(user),
      complete: result.complete,
      passed: result.passed,
      requiredPercent: REQUIRED_PERCENT,
      overallPercent: Number(result.overallPercent.toFixed(2)),
      recipientName: eligible
        ? certificateName(user!.displayName, user!.email)
        : null,
      certificateNumber: eligible
        ? certificateNumber(user!.id, user!.email)
        : null,
      issuedDate: eligible ? issuedDate(result.completedAt) : null,
    }),
  );
});

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
      error: `Certificate status: Not passed. A coursework average of at least ${REQUIRED_PERCENT}% is required; current average is ${Math.round(result.overallPercent)}%.`,
    });
    return;
  }

  const name = certificateName(user.displayName, user.email);
  const pdf = await renderCertificate({
    name,
    certificateNumber: certificateNumber(user.id, user.email),
    issuedDate: issuedDate(result.completedAt),
    overallPercent: result.overallPercent,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="zhi-systems-evolutionary-psychology-series-1-certificate.pdf"',
  );
  res.setHeader("Content-Length", String(pdf.length));
  res.send(pdf);
});

export default router;