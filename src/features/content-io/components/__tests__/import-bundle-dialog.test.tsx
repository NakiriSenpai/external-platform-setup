import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/services/content/bundle/audit.service", () => ({
  recordContentIoAudit: vi.fn(),
}));

const importExam = vi.fn(async (bundle: { data: { title: string }[] }) => ({
  imported: 1,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  createdEntityId: `id-${bundle.data[0]!.title}`,
}));

vi.mock("@/services/content/bundle/bundle-import.service", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/services/content/bundle/bundle-import.service",
  );
  return {
    ...actual,
    readBundleFile: async (file: File) => ({
      ok: true,
      raw: JSON.parse(await file.text()) as unknown,
      sizeBytes: file.size,
    }),
    validateBundle: (raw: unknown) => ({ ok: true, bundle: raw }),
    analyzeExamBundle: async (bundle: {
      data: { title: string; slug: string; sections: unknown[]; question_refs: unknown[] }[];
    }) =>
      bundle.data.map((exam) => ({
        slug: exam.slug,
        title: exam.title,
        sectionCount: exam.sections.length,
        questionRefCount: exam.question_refs.length,
        resolvedKeys: exam.question_refs.map((_, i) => `k${i}`),
        missingKeys: [],
        resolvableFromBundle: [],
        slugTaken: false,
        questionPreview: null,
      })),
    importExam,
  };
});

const { ImportBundleDialog } = await import("../import-bundle-dialog");

afterEach(cleanup);

const bundleFor = (name: string, questions: number) =>
  new File(
    [
      JSON.stringify({
        bundle_type: "exam",
        data: [
          {
            title: `TEST ${name}`,
            slug: `test-${name.toLowerCase()}`,
            sections: [{ key: "s1" }],
            question_refs: Array.from({ length: questions }, (_, i) => ({ key: `q${i}` })),
            question_bundle: [],
          },
        ],
      }),
    ],
    `exam-${name}.json`,
    { type: "application/json" },
  );

async function pick(file: File) {
  const input = document.getElementById("bundle-file") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(file.name)).toBeTruthy());
}

async function importNow() {
  fireEvent.click(screen.getByRole("button", { name: "Import Exam" }));
  await waitFor(() => expect(screen.getByText("Import selesai")).toBeTruthy());
  fireEvent.click(screen.getByText("Import file lain"));
  await waitFor(() => expect(document.getElementById("bundle-file")).toBeTruthy());
}

describe("ImportBundleDialog", () => {
  it("selalu memakai file terbaru untuk preview dan mutation", async () => {
    render(<ImportBundleDialog open onOpenChange={() => {}} bundleType="exam" />);

    const files = {
      A: bundleFor("A", 1),
      B: bundleFor("B", 2),
      C: bundleFor("C", 3),
    } as const;

    for (const name of ["A", "B", "C", "A", "C", "B"] as const) {
      await pick(files[name]);
      expect(screen.getByText(`TEST ${name}`)).toBeTruthy();
      expect(screen.getByText(`slug: test-${name.toLowerCase()}`)).toBeTruthy();
      await importNow();
      const last = importExam.mock.calls.at(-1)![0] as { data: { title: string }[] };
      expect(last.data[0]!.title).toBe(`TEST ${name}`);
    }

    // file input direset setelah dibaca sehingga file yang sama tetap memicu change baru
    expect((document.getElementById("bundle-file") as HTMLInputElement).value).toBe("");
  });

  it("tidak menampilkan opsi conflict atau missing-question untuk Exam", async () => {
    render(<ImportBundleDialog open onOpenChange={() => {}} bundleType="exam" />);
    await pick(bundleFor("A", 1));

    expect(screen.queryByText("Jika data sudah ada")).toBeNull();
    expect(screen.queryByText("Lewati (aman, default)")).toBeNull();
    expect(screen.queryByText("Perbarui data lama")).toBeNull();
    expect(screen.queryByText("Buat sebagai soal baru")).toBeNull();
    expect(screen.queryByText("Import soal yang menyertai bundle")).toBeNull();
    expect(screen.queryByText("Lanjutkan walau ada soal yang hilang")).toBeNull();
    expect(screen.getByRole("button", { name: "Import Exam" })).toBeTruthy();
  });
});
