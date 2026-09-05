import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, PenTool, BarChart3, Activity, RotateCcw, Sparkles, Scale, GraduationCap, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminMode } from "@/lib/adminMode";
import { AccessControls } from "@/components/AccessControls";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Sidebar() {
  const [location] = useLocation();
  const [adminMode] = useAdminMode();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/assignments", label: "Assignments", icon: PenTool },
    { href: "/reasoning", label: "Assessments", icon: Scale },
    { href: "/grades", label: "Grades", icon: GraduationCap },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ...(adminMode
      ? [{ href: "/admin", label: "Administrator", icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="w-64 border-r bg-sidebar flex flex-col h-full h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <a
            href="https://zhisystems.ai/"
            aria-label="Visit ZHI Systems"
            className="shrink-0 rounded-md ring-1 ring-border shadow-sm transition-transform hover:scale-105"
          >
            <img
              src={`${basePath}/zhi-logo.png`}
              alt="ZHI Systems logo"
              className="w-8 h-8 rounded-md object-cover"
            />
          </a>
          <Link href="/dashboard">
            <span className="font-serif font-semibold text-lg tracking-tight">Nano Evolutionary Psychology</span>
          </Link>
        </div>
      </div>

      <div className="flex-1 py-6 flex flex-col gap-2 px-4">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border text-xs text-muted-foreground text-center flex flex-col gap-2">
        <a
          href="mailto:johnmichaelkuczynski@gmail.com"
          className="font-medium text-foreground hover:underline"
        >
          Contact Us
        </a>
        <span>Nano Evolutionary Psychology</span>
      </div>
    </div>
  );
}

function TopBar() {
  const [location, setLocation] = useLocation();
  const active = location.startsWith("/diagnostics");
  const [adminMode, setAdminMode] = useAdminMode();
  const qc = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandProgress, setExpandProgress] = useState<string | null>(null);

  async function handleExpandLectures() {
    setExpanding(true);
    setExpandProgress("Loading lectures…");
    try {
      // Fetch every lecture id so we can rewrite ONE lecture per request.
      // A single bulk request that rewrites all lectures for both levels takes
      // many minutes and gets killed by the proxy, so we drive it client-side
      // with short (~30s) requests and live progress instead.
      const ovRes = await fetch(`${basePath}/api/course/overview`);
      if (!ovRes.ok) throw new Error(`HTTP ${ovRes.status}`);
      const overview = (await ovRes.json()) as {
        weeks: Array<{ lectures: Array<{ id: number }> }>;
      };
      const ids = overview.weeks.flatMap((w) => w.lectures.map((l) => l.id));
      const jobs = ([...ids.map((id) => ({ id, level: "medium" as const })),
        ...ids.map((id) => ({ id, level: "long" as const }))]);
      const total = jobs.length;

      let done = 0;
      let failed = 0;
      for (const job of jobs) {
        done++;
        setExpandProgress(`Rewriting ${done}/${total}…`);
        try {
          const res = await fetch(
            `${basePath}/api/diagnostics/expand-lectures?level=${job.level}&id=${job.id}`,
            { method: "POST" },
          );
          if (!res.ok) {
            failed++;
            continue;
          }
          const data = (await res.json()) as { updated?: number };
          if (!data.updated) failed++;
        } catch {
          failed++;
        }
      }
      await qc.invalidateQueries();
      console.info(
        `Lecture expansion complete — ${total - failed}/${total} succeeded (${failed} failed).`,
      );
    } catch (e) {
      console.error(`Lecture rewrite failed: ${(e as Error).message}`);
    } finally {
      setExpanding(false);
      setExpandProgress(null);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/diagnostics/reset", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await qc.invalidateQueries();
      setLocation("/");
    } catch (e) {
      console.error(`Reset failed: ${(e as Error).message}`);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 flex items-center justify-end gap-2 px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
      <AccessControls compact />
      <button
        onClick={handleExpandLectures}
        disabled={expanding}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-secondary disabled:opacity-50"
        data-testid="button-expand-lectures"
        title="Rewrite every lecture with worked examples after each point"
      >
        <Sparkles className={`w-4 h-4 ${expanding ? "animate-pulse" : ""}`} />
        {expanding ? (expandProgress ?? "Rewriting…") : "Generate medium + long lectures"}
      </button>
      <button
        onClick={handleReset}
        disabled={resetting}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-secondary disabled:opacity-50"
        data-testid="button-reset"
        title="Wipe all student progress — practice, assignments, and diagnostic reasoning tests (keeps lectures and assignments)"
      >
        <RotateCcw className={`w-4 h-4 ${resetting ? "animate-spin" : ""}`} />
        {resetting ? "Resetting…" : "Reset course"}
      </button>
      <Link href="/diagnostics">
        <button
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            active
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-secondary"
          }`}
          data-testid="button-diagnostic"
        >
          <Activity className="w-4 h-4" />
          Diagnostic
        </button>
      </Link>

      <button
        onClick={() => setAdminMode(!adminMode)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          adminMode
            ? "bg-chart-4 text-white"
            : "border border-border hover:bg-secondary"
        }`}
        data-testid="button-admin-toggle"
        title="Administrator mode disables AI detection, enables pasting, and unlocks the Grader Lab"
      >
        <ShieldCheck className="w-4 h-4" />
        {adminMode ? "Admin: On" : "Admin: Off"}
      </button>

    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <TopBar />
        {children}
      </main>
    </div>
  );
}
