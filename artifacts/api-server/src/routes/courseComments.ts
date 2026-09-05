import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, courseCommentsTable } from "@workspace/db";
import {
  CreateCourseCommentBody,
  ListCourseCommentsResponseItem,
  ListCourseCommentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function sentenceCount(value: string): number {
  return value
    .trim()
    .split(/(?<=[.!?])(?:["'”’)]*)\s+/)
    .filter(Boolean).length;
}

router.get("/course/comments", async (_req, res): Promise<void> => {
  const comments = await db
    .select()
    .from(courseCommentsTable)
    .orderBy(desc(courseCommentsTable.createdAt))
    .limit(10);

  res.json(ListCourseCommentsResponse.parse(comments));
});

router.post("/course/comments", async (req, res): Promise<void> => {
  const parsed = CreateCourseCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a comment of 600 characters or fewer." });
    return;
  }

  const comment = parsed.data.comment.trim();
  if (!comment || sentenceCount(comment) > 3) {
    res.status(400).json({ error: "Your comment can contain up to three sentences." });
    return;
  }

  const [saved] = await db
    .insert(courseCommentsTable)
    .values({ comment })
    .returning();

  res.status(201).json(ListCourseCommentsResponseItem.parse(saved));
});

export default router;