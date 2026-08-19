import { CalendarDays, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalyticsExamRow, AnalyticsFilterState } from "@/types/analytics/analytics-v2";

import { DEFAULT_FILTERS, RANGE_PRESETS, daysAgo, toIsoDate } from "../analytics-utils";

export type StudentOption = { user_id: string; display_name: string };

/** Filter global analitik: rentang tanggal, set ujian, dan siswa. */
export function AnalyticsFilterBar({
  filters,
  onChange,
  exams,
  students,
}: {
  filters: AnalyticsFilterState;
  onChange: (next: AnalyticsFilterState) => void;
  exams: AnalyticsExamRow[];
  students: StudentOption[];
}) {
  const set = (patch: Partial<AnalyticsFilterState>) => onChange({ ...filters, ...patch });

  const applyPreset = (days: number) =>
    set({ from: daysAgo(days - 1), to: toIsoDate(new Date()) });

  const activePreset = RANGE_PRESETS.find(
    (p) => filters.from === daysAgo(p.days - 1) && filters.to === toIsoDate(new Date()),
  );

  return (
    <div className="space-y-2.5 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex w-full max-w-full gap-1.5 overflow-x-auto pb-0.5">
        {RANGE_PRESETS.map((preset) => (
          <Button
            key={preset.days}
            size="sm"
            variant={activePreset?.days === preset.days ? "default" : "outline"}
            className="h-8 shrink-0 rounded-full px-3 text-xs"
            onClick={() => applyPreset(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 rounded-full px-3 text-xs"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
        >
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="min-w-0 space-y-1">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3" /> Dari
          </span>
          <Input
            type="date"
            className="h-9 text-xs"
            value={filters.from}
            max={filters.to}
            onChange={(e) => set({ from: e.target.value })}
          />
        </label>
        <label className="min-w-0 space-y-1">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3" /> Sampai
          </span>
          <Input
            type="date"
            className="h-9 text-xs"
            value={filters.to}
            min={filters.from}
            onChange={(e) => set({ to: e.target.value })}
          />
        </label>

        <label className="min-w-0 space-y-1">
          <span className="text-[11px] text-muted-foreground">Set Ujian</span>
          <Select
            value={filters.examId ?? "all"}
            onValueChange={(v) => set({ examId: v === "all" ? null : v })}
          >
            <SelectTrigger className="h-9 text-xs" aria-label="Filter set ujian">
              <SelectValue placeholder="Semua Set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Set Ujian</SelectItem>
              {exams.map((exam) => (
                <SelectItem key={exam.exam_id} value={exam.exam_id}>
                  {exam.exam_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="min-w-0 space-y-1">
          <span className="text-[11px] text-muted-foreground">Siswa</span>
          <Select
            value={filters.studentId ?? "all"}
            onValueChange={(v) => set({ studentId: v === "all" ? null : v })}
          >
            <SelectTrigger className="h-9 text-xs" aria-label="Filter siswa">
              <SelectValue placeholder="Semua Siswa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Siswa</SelectItem>
              {students.map((student) => (
                <SelectItem key={student.user_id} value={student.user_id}>
                  {student.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  );
}
