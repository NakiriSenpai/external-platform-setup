import { BookOpen, GraduationCap, Trophy, User } from "lucide-react";

import {
  DashboardHeader,
  SectionTitle,
  ShortcutGrid,
  type ShortcutItem,
} from "@/features/dashboard/components/dashboard-primitives";
import { StudentLessonProgressPanel } from "@/features/dashboard/components/student-lesson-progress";
import { DownloadAppBanner } from "@/features/download/components/download-app-banner";
import { useAuth } from "@/hooks/auth";


const LEARNING: ShortcutItem[] = [
  {
    to: "/materi",
    label: "Materi",
    description: "Baca materi pembelajaran terbit.",
    icon: BookOpen,
  },
  {
    to: "/ujian",
    label: "Ujian",
    description: "Kerjakan ujian yang tersedia.",
    icon: GraduationCap,
  },
  {
    to: "/leaderboard",
    label: "Peringkat",
    description: "Lihat posisi Anda di antara siswa lain.",
    icon: Trophy,
  },
  {
    to: "/profile",
    label: "Profil",
    description: "Data akun dan pengaturan.",
    icon: User,
  },
];

/** Dashboard siswa: pintasan belajar utama. */
export function StudentDashboard() {
  const { profile } = useAuth();
  const nama = profile?.display_name ?? profile?.full_name ?? "Peserta";

  return (
    <section className="space-y-6">
      <DashboardHeader title={`Halo, ${nama}`} subtitle="Lanjutkan belajar Anda hari ini." />
      <div className="space-y-2">
        <SectionTitle>Belajar</SectionTitle>
        <ShortcutGrid items={LEARNING} />
      </div>
      <StudentLessonProgressPanel />
      <DownloadAppBanner />
    </section>
  );
}

