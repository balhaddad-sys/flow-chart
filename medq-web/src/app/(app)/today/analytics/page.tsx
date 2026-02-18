"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCourseStore } from "@/lib/stores/course-store";
import { SectionLoadingState } from "@/components/ui/loading-state";
import { ArrowLeft } from "lucide-react";

const AnalyticsCharts = dynamic(
  () => import("@/components/home/analytics-charts").then((mod) => mod.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 md:grid-cols-2">
        <SectionLoadingState title="Preparing charts" description="Rendering your progress visuals." rows={2} />
        <SectionLoadingState title="Preparing insights" description="Collecting accuracy and task stats." rows={2} />
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { loading: tasksLoading } = useTasks(courseId);

  if (tasksLoading) {
    return (
      <div className="page-wrap page-stack max-w-6xl">
        <SectionLoadingState
          title="Loading analytics"
          description="Crunching your study trends and performance data."
          rows={2}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <SectionLoadingState title="Preparing charts" description="Rendering your progress visuals." rows={2} />
          <SectionLoadingState title="Preparing insights" description="Collecting accuracy and task stats." rows={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap page-stack max-w-6xl">
      <Link
        href="/today"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Today
      </Link>

      <div className="glass-card p-5 sm:p-6">
        <h1 className="page-title animate-in-up stagger-1">Detailed Analytics</h1>
        <p className="page-subtitle animate-in-up stagger-2">
          Visual breakdown of your study patterns and performance.
        </p>
      </div>

      <AnalyticsCharts courseId={courseId} />
    </div>
  );
}
