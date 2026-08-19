import { useMemo, useState } from "react";
import { BarChart3, CalendarCheck, LineChart, Table2, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExamPerformance, useStudentRows } from "@/hooks/analytics";
import type { AnalyticsFilterState } from "@/types/analytics/analytics-v2";

import { DEFAULT_FILTERS } from "../analytics-utils";
import { AnalyticsFilterBar } from "./analytics-filter-bar";
import { TabAnalisis } from "./tab-analisis";
import { TabAttendance } from "./tab-attendance";
import { TabRingkasan } from "./tab-ringkasan";
import { TabSiswa } from "./tab-siswa";
import { TabTabelNilai } from "./tab-tabel-nilai";

const TABS = [
  { value: "ringkasan", label: "Ringkasan", icon: LineChart },
  { value: "siswa", label: "Siswa", icon: Users },
  { value: "nilai", label: "Tabel Nilai", icon: Table2 },
  { value: "analisis", label: "Analisis", icon: BarChart3 },
  { value: "attendance", label: "Attendance", icon: CalendarCheck },
] as const;

/** Dashboard Analitik Guru / Platform (Sprint 28).
 *  Nilai & kelulusan memakai attempt pertama; total ujian memakai semua attempt. */
export function TeacherAnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilterState>(DEFAULT_FILTERS);

  // Opsi filter: seluruh set ujian & siswa pada rentang aktif (tanpa filter set).
  const optionFilters = useMemo<AnalyticsFilterState>(
    () => ({ ...filters, examId: null, studentId: null }),
    [filters],
  );
  const examsQuery = useExamPerformance(optionFilters);
  const studentsQuery = useStudentRows(
    useMemo(
      () => ({ ...optionFilters, search: "", includeExcluded: false, page: 1, pageSize: 200 }),
      [optionFilters],
    ),
  );

  const exams = examsQuery.data ?? [];
  const students = studentsQuery.data?.rows ?? [];

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground">Analitik</h1>
          <p className="truncate text-xs text-muted-foreground">
            Performa, kehadiran, dan pola jawaban siswa Anda.
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <BarChart3 className="size-5" />
        </span>
      </header>

      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        exams={exams}
        students={students.map((s) => ({ user_id: s.user_id, display_name: s.display_name }))}
      />

      <Tabs defaultValue="ringkasan" className="w-full max-w-full">
        <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-2xl p-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="shrink-0 gap-1.5 rounded-xl px-3 py-1.5 text-xs"
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ringkasan" className="mt-3">
          <TabRingkasan filters={filters} />
        </TabsContent>
        <TabsContent value="siswa" className="mt-3">
          <TabSiswa filters={filters} />
        </TabsContent>
        <TabsContent value="nilai" className="mt-3">
          <TabTabelNilai filters={filters} />
        </TabsContent>
        <TabsContent value="analisis" className="mt-3">
          <TabAnalisis
            filters={filters}
            exams={exams}
            onExamChange={(examId) => setFilters((prev) => ({ ...prev, examId }))}
          />
        </TabsContent>
        <TabsContent value="attendance" className="mt-3">
          <TabAttendance filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
