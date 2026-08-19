import {
  BarChart3,
  BookOpen,
  Building2,
  FileSpreadsheet,
  GraduationCap,
  Image as ImageIcon,
  Library,
  Settings,
  Users,
} from "lucide-react";

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
import { usePlatformStats } from "@/hooks/platform";

const MANAGEMENT: ShortcutItem[] = [
  {
    to: "/owner/tenants",
    label: "Manajemen Tenant",
    description: "Lembaga, status aktif, dan admin pertama.",
    icon: Building2,
  },
  {
    to: "/owner/users",
    label: "Manajemen User",
    description: "Seluruh pengguna pada semua tenant.",
    icon: Users,
  },
];

const CONTENT: ShortcutItem[] = [
  {
    to: "/owner/exam-studio",
    label: "Exam Studio",
    description: "Susun ujian, section, dan soal.",
    icon: FileSpreadsheet,
  },
  {
    to: "/owner/lesson-studio",
    label: "Lesson Studio",
    description: "CMS materi pembelajaran.",
    icon: BookOpen,
  },
  {
    to: "/owner/question-bank",
    label: "Question Bank",
    description: "Library soal untuk Exam dan Lesson.",
    icon: Library,
  },
];

const TOOLS: ShortcutItem[] = [
  {
    to: "/media",
    label: "Media",
    description: "Unggah gambar dan audio terpusat.",
    icon: ImageIcon,
  },
  {
    to: "/teacher/analytics",
    label: "Platform Analytics",
    description: "Performa siswa, ujian, dan soal.",
    icon: BarChart3,
  },
  {
    to: "/owner/settings",
    label: "Pengaturan Platform",
    description: "Branding, feature flag, dan mode pemeliharaan.",
    icon: Settings,
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

/** Dashboard Owner: ringkasan platform + akses cepat management. */
export function OwnerDashboard() {
  const stats = usePlatformStats();

  return (
    <section className="space-y-6">
      <DashboardHeader title="Dashboard" subtitle="Kelola platform dan seluruh tenant." />

      <div className="space-y-2">
        <SectionTitle>Overview</SectionTitle>
        {stats.isLoading ? (
          <StatGridSkeleton count={5} />
        ) : stats.isError ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Ringkasan platform tidak dapat dimuat.
            </CardContent>
          </Card>
        ) : (
          <StatGrid>
            <StatCard label="Total Tenant" value={stats.data?.tenants ?? 0} emphasis />
            <StatCard label="Total User" value={stats.data?.users ?? 0} emphasis />
            <StatCard label="User Aktif" value={stats.data?.activeUsers ?? 0} />
            <StatCard label="Exam Terbit" value={stats.data?.publishedExams ?? 0} />
            <StatCard label="Materi Terbit" value={stats.data?.publishedLessons ?? 0} />
          </StatGrid>
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle>Management</SectionTitle>
        <ShortcutGrid items={MANAGEMENT} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Content</SectionTitle>
        <ShortcutGrid items={CONTENT} />
        <p className="text-xs text-muted-foreground">
          Import / Export bundle JSON tersedia di dalam Exam Studio, Lesson Studio, dan Question
          Bank.
        </p>
      </div>

      <div className="space-y-2">
        <SectionTitle>Media &amp; Analytics</SectionTitle>
        <ShortcutGrid items={TOOLS} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Learning</SectionTitle>
        <ShortcutGrid items={LEARNING} />
      </div>
    </section>
  );
}
