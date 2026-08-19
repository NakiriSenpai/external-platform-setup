import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAttendance } from "@/hooks/analytics";
import type { AnalyticsFilterState } from "@/types/analytics/analytics-v2";

import { angka, dateTime, persen, shortDate } from "../analytics-utils";
import {
  AnalyticsEmpty,
  AnalyticsError,
  AnalyticsSkeleton,
  MetricRow,
  SectionCard,
  StatTile,
  StatTileGrid,
  StudentAvatar,
} from "./analytics-ui";

/** Tab Attendance: kehadiran/aktivitas harian siswa. */
export function TabAttendance({ filters }: { filters: AnalyticsFilterState }) {
  const query = useAttendance(filters);
  const data = query.data;

  if (query.isLoading) return <AnalyticsSkeleton rows={5} />;
  if (query.isError) return <AnalyticsError onRetry={() => void query.refetch()} />;

  const daily = data?.daily ?? [];
  const students = data?.students ?? [];

  return (
    <div className="space-y-3">
      <StatTileGrid>
        <StatTile
          tone="primary"
          label="Siswa Hadir"
          value={`${angka(data?.active_students ?? 0)}/${angka(data?.total_students ?? 0)}`}
          hint={`Dalam ${angka(data?.range_days ?? 0)} hari`}
        />
        <StatTile label="Rata-rata Harian" value={angka(data?.average_daily_active ?? 0, 1)} />
        <StatTile label="Total Sesi" value={angka(data?.total_sessions ?? 0)} />
        <StatTile
          tone="success"
          label="Tingkat Kehadiran"
          value={persen(
            data && data.total_students > 0
              ? (data.active_students / data.total_students) * 100
              : 0,
          )}
        />
      </StatTileGrid>

      <SectionCard title="Aktivitas Harian" bodyClassName="p-3">
        {daily.length === 0 ? (
          <AnalyticsEmpty
            title="Belum ada data kehadiran"
            description="Kehadiran tercatat otomatis saat siswa membuka aplikasi setelah migration dijalankan."
          />
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => shortDate(String(v))}
                  formatter={(v: number) => [angka(v), "Siswa hadir"]}
                />
                <Bar dataKey="students" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Kehadiran per Siswa">
        {students.length === 0 ? (
          <AnalyticsEmpty title="Belum ada siswa" />
        ) : (
          <ul className="space-y-2">
            {students.map((student) => (
              <li key={student.user_id} className="min-w-0 space-y-2 rounded-xl border p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StudentAvatar name={student.display_name} avatarUrl={student.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {student.display_name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Terakhir aktif {dateTime(student.last_seen_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
                    {angka(student.days_present)} hari
                  </span>
                </div>
                <MetricRow
                  label="Tingkat kehadiran"
                  value={student.attendance_rate}
                  display={persen(student.attendance_rate)}
                  tone={student.attendance_rate >= 50 ? "success" : "warning"}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
