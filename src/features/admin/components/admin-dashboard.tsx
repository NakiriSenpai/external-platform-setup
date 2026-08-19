import { BarChart3, BookOpen, GraduationCap, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/hooks/auth";
import { useTenantUserStats } from "@/hooks/users";
import { RefreshCw } from "lucide-react";

const QUICK: ShortcutItem[] = [
  {
    to: "/admin/users",
    label: "Manajemen User",
    description: "Kelola guru dan siswa pada lembaga Anda.",
    icon: Users,
  },
  {
    to: "/admin/analytics",
    label: "Analitik Tenant",
    description: "Performa ujian dan siswa lembaga Anda.",
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

/**
 * Dashboard operasional Admin Tenant (Sprint 14.1).
 * Management user & analitik tenant + akses konsumsi konten (bukan studio).
 */
export function AdminDashboard() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const users = useTenantUserStats(tenantId);
  const overview = useAnalyticsOverview({ range: "30" });

  const isLoading = users.isLoading || overview.isLoading;
  const isError = users.isError || overview.isError;
  const retry = () => {
    void users.refetch();
    void overview.refetch();
  };

  return (
    <section className="space-y-6">
      <DashboardHeader title="Dashboard" subtitle="Kelola operasional tenant Anda." />

      <div className="space-y-2">
        <SectionTitle>Overview (30 hari)</SectionTitle>
        {isLoading ? (
          <StatGridSkeleton count={7} />
        ) : isError ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">Gagal memuat data.</p>
              <Button variant="outline" className="min-h-11" onClick={retry}>
                <RefreshCw className="mr-2 size-4" />
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <StatGrid>
            <StatCard label="Total User" value={users.data?.total ?? 0} emphasis />
            <StatCard label="Guru" value={users.data?.guru ?? 0} />
            <StatCard label="Siswa" value={users.data?.siswa ?? 0} />
            <StatCard
              label="User Aktif"
              value={users.data?.aktif ?? 0}
              hint={`Nonaktif: ${users.data?.nonaktif ?? 0}`}
            />
            <StatCard label="Ujian Selesai" value={overview.data?.total_attempts ?? 0} emphasis />
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
        <SectionTitle>Quick Actions</SectionTitle>
        <ShortcutGrid items={QUICK} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Learning</SectionTitle>
        <ShortcutGrid items={LEARNING} />
      </div>
    </section>
  );
}
