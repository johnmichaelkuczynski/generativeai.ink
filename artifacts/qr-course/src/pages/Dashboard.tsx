import React from "react";
import { useGetCourseOverview, useGetRecentActivity } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ReasoningCallout } from "@/components/ReasoningCallout";
import TopicsRail from "@/components/TopicsRail";
import { CourseCommentsCard } from "@/components/CourseCommentsCard";

export default function Dashboard() {
  const { data: overview, isLoading: isLoadingOverview } = useGetCourseOverview();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();

  return (
    <Layout>
      <div className="flex items-start w-full">
        <div className="hidden xl:block pl-6 pt-6">
          <TopicsRail />
        </div>
      <div className="p-8 max-w-6xl mx-auto w-full flex flex-col gap-8 min-w-0">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">
            {overview ? "Nano Evolutionary Psychology" : <Skeleton className="h-9 w-64" />}
          </h1>
          <p className="text-muted-foreground">Welcome to your Nano Evolutionary Psychology course workspace.</p>
        </div>

        <ReasoningCallout phase="before" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOverview ? <Skeleton className="h-10 w-24" /> : (
                <>
                  <div className="text-3xl font-serif font-bold mb-2">
                    {overview?.totals.assignmentsCompleted} / {overview?.totals.assignmentsTotal}
                  </div>
                  <Progress value={(overview?.totals.assignmentsCompleted || 0) / Math.max(overview?.totals.assignmentsTotal || 1, 1) * 100} className="h-2" />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Practice Problems</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOverview ? <Skeleton className="h-10 w-24" /> : (
                <div className="text-3xl font-serif font-bold">{overview?.totals.practiceCount}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 flex flex-col gap-4">
            <h2 className="text-xl font-serif font-semibold">Course Schedule</h2>
            {isLoadingOverview ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : (
              overview?.weeks.map(week => (
                <Link key={week.weekNumber} href={`/weeks/${week.weekNumber}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer cursor-pointer hover:shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Day {week.weekNumber}: {week.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{week.summary}</p>
                      <div className="flex gap-4 text-sm font-medium">
                        <span className="text-primary">{week.lectures.length} Lectures</span>
                        <span className="text-primary">{week.assignments.length} Assignments</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-serif font-semibold">Recent Activity</h2>
            <Card>
              <CardContent className="p-0 divide-y">
                {isLoadingActivity ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>)
                ) : activity?.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No recent activity.</div>
                ) : (
                  activity?.slice(0, 5).map(item => (
                    <div key={item.id} className="p-4 flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm">{item.title}</span>
                        {item.score !== undefined && item.score !== null && (
                          <span className="text-xs font-bold px-2 py-0.5 bg-secondary rounded-full">{item.score}%</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.kind === 'practice' ? 'Practice' : 'Assignment'} • {new Date(item.at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <CourseCommentsCard />
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
}
