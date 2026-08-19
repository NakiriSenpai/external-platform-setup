import { BarChart3, BookOpen, GraduationCap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  DashboardHeader,
  SectionTitle,
  ShortcutGrid,
  StatCard,
  StatGrid,
  StatGridSkeleton,
  type ShortcutItem,
} from "@/features/dashboard/components/dashboard-primitives";
import { useAnalyticsOverview } from "@/hooks/analytics";

const QUICK: ShortcutItem[] = [
  {
    to: "/teacher/analytics",
    label: "Analitik",
    description: "Performa siswa, ujian, dan soal.",
    icon: BarChart3,
  },
];

const LEARNING: ShortcutItem[] = [
  {
    to: "/ujian",
    label: "Ujian",
    description: "Kerjakan ujian yang sudah terbit.",
    icon: GraduationCap,
  },
  {
    to: "/materi",
    label: "Materi",
    description: "Baca materi pembelajaran terbit.",
    icon: BookOpen,
  },
];

/** Dashboard Guru: pantau aktivitas belajar siswa pada tenant sendiri. */
export function TeacherDashboard() {
  const overview = useAnalyticsOverview({ range: "30" });

  return (
    <section className="space-y-6">
      <DashboardHeader title="Dashboard" subtitle="Pantau aktivitas belajar siswa Anda." />

      <div className="space-y-2">
        <SectionTitle>Overview (30 hari)</SectionTitle>
        {overview.isLoading ? (
          <StatGridSkeleton count={5} />
        ) : overview.isError ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Data analitik tidak dapat dimuat.
            </CardContent>
          </Card>
        ) : (
          <StatGrid>
            <StatCard label="Total Siswa" value={overview.data?.total_students ?? 0} emphasis />
            <StatCard label="Siswa Aktif" value={overview.data?.active_students ?? 0} emphasis />
            <StatCard label="Ujian Dikerjakan" value={overview.data?.total_attempts ?? 0} />
            <StatCard
              label="Rata-rata Nilai"
              value={Math.round(overview.data?.average_score ?? 0)}
            />
            <StatCard
              label="Tingkat Lulus"
              value={`${Math.round(overview.data?.pass_rate ?? 0)}%`}
            />
          </StatGrid>
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle>Quick Access</SectionTitle>
        <ShortcutGrid items={QUICK} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Learning</SectionTitle>
        <ShortcutGrid items={LEARNING} />
      </div>
    </section>
  );
}
