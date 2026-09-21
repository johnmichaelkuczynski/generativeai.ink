import { Users } from "lucide-react";
import {
  getGetVisitorCountQueryKey,
  useGetVisitorCount,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function VisitorCounter({ className }: { className?: string }) {
  const { data, isLoading } = useGetVisitorCount({
    query: {
      queryKey: getGetVisitorCountQueryKey(),
      refetchInterval: 60_000,
      staleTime: 30_000,
    },
  });

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm",
        className,
      )}
      aria-label={
        data
          ? `${data.allTime.toLocaleString()} unique visitors`
          : "Unique visitor count loading"
      }
      data-testid="visitor-counter"
    >
      <Users className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="text-muted-foreground">Visitors</span>
      <span className="tabular-nums">
        {isLoading ? "…" : (data?.allTime.toLocaleString() ?? "—")}
      </span>
    </div>
  );
}