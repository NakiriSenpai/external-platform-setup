import type { ScoreMatrix } from "@/types/analytics/analytics-v2";

import { angka, longDate } from "./analytics-utils";

type MatrixTable = { head: string[]; body: (string | number)[][] };

/** Susun tabel nilai (attempt pertama) menjadi baris siap ekspor. */
export function buildScoreTable(matrix: ScoreMatrix): MatrixTable {
  const head = [
    "No",
    "Nama Siswa",
    ...matrix.exams.map((e) => e.exam_title),
    "Rata-rata",
    "Set Diikuti",
  ];
  const body = matrix.students.map((s, i) => [
    i + 1,
    s.display_name,
    ...matrix.exams.map((e) => {
      const cell = s.scores[e.exam_id];
      return cell ? Number(cell.score) : "—";
    }),
    Number(s.average_score),
    s.taken,
  ]);
  return { head, body };
}

function fileStamp(from: string, to: string) {
  return `${from}_sd_${to}`;
}

/** Ekspor tabel nilai ke Excel (.xlsx). */
export async function exportScoreExcel(matrix: ScoreMatrix, from: string, to: string) {
  const XLSX = await import("xlsx");
  const { head, body } = buildScoreTable(matrix);
  const sheet = XLSX.utils.aoa_to_sheet([head, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Tabel Nilai");
  XLSX.writeFile(book, `tabel-nilai_${fileStamp(from, to)}.xlsx`);
}

/** Ekspor tabel nilai ke PDF (landscape, auto table). */
export async function exportScorePdf(matrix: ScoreMatrix, from: string, to: string) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const { head, body } = buildScoreTable(matrix);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Tabel Nilai Siswa", 40, 40);
  doc.setFontSize(9);
  doc.text(
    `Periode ${longDate(from)} – ${longDate(to)} · Nilai = attempt pertama · ${angka(matrix.students.length)} siswa`,
    40,
    56,
  );

  autoTable(doc, {
    head: [head],
    body: body.map((row) => row.map((cell) => String(cell))),
    startY: 70,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [124, 92, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 244, 255] },
  });

  doc.save(`tabel-nilai_${fileStamp(from, to)}.pdf`);
}
