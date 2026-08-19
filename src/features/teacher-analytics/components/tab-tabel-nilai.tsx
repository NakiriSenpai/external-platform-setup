import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useScoreMatrix } from "@/hooks/analytics";
import { cn } from "@/lib/utils";
import type { AnalyticsFilterState } from "@/types/analytics/analytics-v2";

import { exportScoreExcel, exportScorePdf } from "../analytics-export";
import { angka } from "../analytics-utils";
import {
  AnalyticsEmpty,
  AnalyticsError,
  AnalyticsSkeleton,
  ScrollArea,
  SectionCard,
} from "./analytics-ui";

/** Tab Tabel Nilai: matriks siswa x set ujian (nilai attempt pertama) + ekspor. */
export function TabTabelNilai({ filters }: { filters: AnalyticsFilterState }) {
  const query = useScoreMatrix(filters);
  const [busy, setBusy] = useState(false);
  const matrix = query.data;
  const hasData = (matrix?.students.length ?? 0) > 0 && (matrix?.exams.length ?? 0) > 0;

  const runExport = async (kind: "excel" | "pdf") => {
    if (!matrix) return;
    setBusy(true);
    try {
      if (kind === "excel") await exportScoreExcel(matrix, filters.from, filters.to);
      else await exportScorePdf(matrix, filters.from, filters.to);
      toast.success("Berkas berhasil diunduh.");
    } catch {
      toast.error("Gagal membuat berkas ekspor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Tabel Nilai"
      description="Nilai attempt pertama setiap siswa per set ujian"
      bodyClassName="p-0"
      action={
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs"
            disabled={!hasData || busy}
            onClick={() => void runExport("excel")}
          >
            <FileSpreadsheet className="size-3.5" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs"
            disabled={!hasData || busy}
            onClick={() => void runExport("pdf")}
          >
            <FileText className="size-3.5" /> PDF
          </Button>
        </div>
      }
    >
      {query.isLoading ? (
        <AnalyticsSkeleton rows={5} />
      ) : query.isError ? (
        <AnalyticsError onRetry={() => void query.refetch()} />
      ) : !hasData ? (
        <AnalyticsEmpty description="Belum ada nilai pada rentang dan filter ini." />
      ) : (
        <ScrollArea>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold">
                  Siswa
                </th>
                {matrix!.exams.map((exam) => (
                  <th key={exam.exam_id} className="max-w-40 px-3 py-2 text-center font-semibold">
                    <span className="block truncate">{exam.exam_title}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold">Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {matrix!.students.map((student) => (
                <tr key={student.user_id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 max-w-44 bg-card px-3 py-2">
                    <span className="block truncate font-medium text-foreground">
                      {student.display_name}
                    </span>
                  </td>
                  {matrix!.exams.map((exam) => {
                    const cell = student.scores[exam.exam_id];
                    return (
                      <td key={exam.exam_id} className="px-3 py-2 text-center tabular-nums">
                        {cell ? (
                          <span
                            className={cn(
                              "inline-block min-w-10 rounded-full px-2 py-0.5 font-semibold",
                              cell.passed
                                ? "bg-success/15 text-success"
                                : "bg-destructive/12 text-destructive",
                            )}
                          >
                            {angka(cell.score, 1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold tabular-nums text-primary">
                    {angka(student.average_score, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </SectionCard>
  );
}
