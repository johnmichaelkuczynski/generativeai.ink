import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const courseCommentsTable = pgTable("course_comments", {
  id: serial("id").primaryKey(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCourseCommentSchema = createInsertSchema(
  courseCommentsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertCourseComment = z.infer<typeof insertCourseCommentSchema>;
export type CourseComment = typeof courseCommentsTable.$inferSelect;