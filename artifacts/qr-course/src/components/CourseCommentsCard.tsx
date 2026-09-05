import React, { useMemo, useState } from "react";
import {
  getListCourseCommentsQueryKey,
  useCreateCourseComment,
  useListCourseComments,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function countSentences(value: string): number {
  if (!value.trim()) return 0;
  return value
    .trim()
    .split(/(?<=[.!?])(?:["'”’)]*)\s+/)
    .filter(Boolean).length;
}

export function CourseCommentsCard() {
  const [comment, setComment] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const queryClient = useQueryClient();
  const { data: comments } = useListCourseComments();
  const createComment = useCreateCourseComment();
  const sentenceCount = useMemo(() => countSentences(comment), [comment]);
  const isTooLong = comment.length > 600;
  const hasTooManySentences = sentenceCount > 3;
  const canSave =
    Boolean(comment.trim()) &&
    !isTooLong &&
    !hasTooManySentences &&
    !createComment.isPending;

  const save = () => {
    if (!canSave) return;
    setSavedMessage("");
    createComment.mutate(
      { data: { comment: comment.trim() } },
      {
        onSuccess: () => {
          setComment("");
          setSavedMessage("Your thoughts were saved.");
          queryClient.invalidateQueries({
            queryKey: getListCourseCommentsQueryKey(),
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Course comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Share up to three sentences about the course.
        </p>
        <Textarea
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            setSavedMessage("");
          }}
          maxLength={601}
          rows={4}
          placeholder="Type your thoughts here."
          aria-label="Course comments"
          aria-describedby="course-comment-status"
        />
        <div
          id="course-comment-status"
          className="flex items-center justify-between gap-3 text-xs"
          aria-live="polite"
        >
          <span
            className={
              isTooLong || hasTooManySentences
                ? "text-destructive"
                : "text-muted-foreground"
            }
          >
            {sentenceCount}/3 sentences · {comment.length}/600 characters
          </span>
          <Button size="sm" onClick={save} disabled={!canSave}>
            {createComment.isPending ? "Saving…" : "Save thoughts"}
          </Button>
        </div>
        {hasTooManySentences && (
          <p className="text-xs text-destructive">
            Please keep your comment to three sentences.
          </p>
        )}
        {createComment.isError && (
          <p className="text-xs text-destructive">
            Your comment could not be saved. Please try again.
          </p>
        )}
        {savedMessage && (
          <p className="text-xs font-medium text-primary">{savedMessage}</p>
        )}
        {comments?.[0] && (
          <div className="border-t pt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Most recent comment
            </p>
            <p className="text-sm leading-relaxed">{comments[0].comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}