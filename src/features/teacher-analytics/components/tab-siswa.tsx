import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSetStudentExcluded, useStudentRows } from "@/hooks/analytics";
import type { AnalyticsFilterState, AnalyticsStudentRow } from "@/types/analytics/analytics-v2";

import { angka, dateTime, persen } from "../analytics-utils";
import {
  AnalyticsEmpty,
  AnalyticsError,
  AnalyticsSkeleton,
  MetricRow,
  SectionCard,
  StudentAvatar,
} from "./analytics-ui";
import { StudentAttemptsDialog } from "./student-attempts-dialog";

const PAGE_SIZE = 12;

/** Tab Siswa: kelola status analitik + lihat riwayat attempt per siswa. */
export function TabSiswa({ filters }: { filters: AnalyticsFilterState }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AnalyticsStudentRow | null>(null);

  const params = useMemo(
    () => ({ ...filters, search, includeExcluded: true, page, pageSize: PAGE_SIZE }),
    [filters, search, page],
  );
  const query = useStudentRows(params);
  const mutation = useSetStudentExcluded();

  const rows = query.data?.rows ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  const toggleStudent = (student: AnalyticsStudentRow, active: boolean) => {
    mutation.mutate(
      { userIds: [student.user_id], excluded: !active },
      {
        onSuccess: () =>
          toast.success(
            active
              ? `${student.display_name} dihitung dalam analitik.`
              : `${student.display_name} dikecualikan dari analitik.`,
          ),
        onError: () => toast.error("Gagal memperbarui status siswa."),
      },
    );
  };

  const bulk = (active: boolean) => {
    const ids = rows.map((r) => r.user_id);
    if (ids.length === 0) return;
    mutation.mutate(
      { userIds: ids, excluded: !active },
      {
        onSuccess: () => toast.success(active ? "Semua siswa diaktifkan." : "Semua siswa dinonaktifkan."),
        onError: () => toast.error("Gagal memperbarui status siswa."),
      },
    );
  };

  return (
    <div className="space-y-3">
      <SectionCard
        title="Kelola Siswa"
        description="Nonaktifkan siswa agar tidak dihitung dalam analitik (persistent)."
        bodyClassName="space-y-3 p-3"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama siswa"
              className="h-9 pl-8 text-xs"
            />
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-2.5 text-xs"
              disabled={mutation.isPending || rows.length === 0}
              onClick={() => bulk(true)}
            >
              Aktifkan
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-2.5 text-xs"
              disabled={mutation.isPending || rows.length === 0}
              onClick={() => bulk(false)}
            >
              Nonaktifkan
            </Button>
          </div>
        </div>

        {query.isLoading ? (
          <AnalyticsSkeleton rows={4} />
        ) : query.isError ? (
          <AnalyticsError onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <AnalyticsEmpty title="Siswa tidak ditemukan" description="Ubah kata kunci pencarian." />
        ) : (
          <ul className="space-y-2">
            {rows.map((student) => {
              const active = !student.analytics_excluded;
              return (
                <li
                  key={student.user_id}
                  className="min-w-0 space-y-2 rounded-xl border p-3 data-[inactive=true]:opacity-60"
                  data-inactive={!active}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2.5 text-left"
                      onClick={() => setSelected(student)}
                    >
                      <StudentAvatar
                        name={student.display_name}
                        avatarUrl={student.avatar_url}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {student.display_name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {angka(student.attempts)} ujian · {angka(student.exams_taken)} set ·
                          terakhir {dateTime(student.last_submitted_at)}
                        </span>
                      </span>
                    </button>
                    <Switch
                      checked={active}
                      disabled={mutation.isPending}
                      aria-label={`Status analitik ${student.display_name}`}
                      onCheckedChange={(checked) => toggleStudent(student, checked)}
                      className="shrink-0"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MetricRow
                      label="Rata-rata"
                      value={student.average_score}
                      display={angka(student.average_score, 1)}
                    />
                    <MetricRow
                      label="Kelulusan"
                      value={student.pass_rate}
                      display={persen(student.pass_rate)}
                      tone={student.pass_rate >= 60 ? "success" : "danger"}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <span className="text-xs text-muted-foreground">
              Halaman {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Berikutnya
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <StudentAttemptsDialog
        student={selected}
        filters={filters}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
