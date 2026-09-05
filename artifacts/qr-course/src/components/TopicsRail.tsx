import { Download } from "lucide-react";

const base = import.meta.env.BASE_URL;
export const pdfUrl = `${base}api/course/download-pdf`;
export const txtUrl = `${base}api/course/download-txt`;

const COURSE_TOPIC_TITLES = [
  "Evolutionary foundations of behavior",
  "Natural and sexual selection",
  "Mating strategies and kin selection",
  "Parenting and family dynamics",
  "Cooperation and social exchange",
  "Aggression and warfare",
  "Status, prestige, and dominance",
  "Evolutionary cognitive psychology",
];

export function useCourseTopicTitles(): string[] {
  return COURSE_TOPIC_TITLES;
}

/**
 * Small, unobtrusive vertical list of every topic covered in the course,
 * meant to sit at the top-left of the Landing page and Dashboard.
 * No unit/week meta-markers — just the plain topic titles.
 */
export default function TopicsRail() {
  const titles = useCourseTopicTitles();
  if (titles.length === 0) return null;

  return (
    <aside
      className="w-56 shrink-0 rounded-lg border border-border bg-card p-4"
      data-testid="topics-rail"
    >
      <h2 className="font-serif font-bold text-base mb-0.5">
        Topics Covered in This Course
      </h2>
      <p className="text-[11px] text-muted-foreground mb-3">
        {titles.length} topics
      </p>
      <ul className="space-y-2.5">
        {titles.map((t) => (
          <li
            key={t}
            className="text-sm font-medium leading-snug text-foreground"
            data-testid={`topics-rail-item`}
          >
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-1.5">
        <a
          href={pdfUrl}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          data-testid="rail-download-pdf"
        >
          <Download className="w-3.5 h-3.5" />
          Download Nano Evolutionary Psychology (PDF)
        </a>
        <a
          href={txtUrl}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-secondary transition-colors"
          data-testid="rail-download-txt"
        >
          <Download className="w-3.5 h-3.5" />
          Download Nano Evolutionary Psychology (TXT)
        </a>
        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
          Every lecture (short version) plus practice homework and exam
          problems.
        </p>
      </div>
    </aside>
  );
}
