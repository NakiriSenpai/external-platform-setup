import { describe, expect, it } from "vitest";

import {
  localizeExplanation,
  migrateExplanationText,
  resolveChoiceTokens,
} from "@/lib/choice-reference";

const answers = [
  { label: "A", text: "시계" },
  { label: "B", text: "가방" },
  { label: "C", text: "여권" },
  { label: "D", text: "의자" },
];

describe("migrateExplanationText", () => {
  it("maps verified references and keeps the sentence intact", () => {
    const r = migrateExplanationText("Jawaban yang benar adalah ② 가방. ❌ ① 시계 untuk waktu.", answers);
    expect(r.migrated).toBe(
      "Jawaban yang benar adalah [[pilihan:B]] 가방. ❌ [[pilihan:A]] 시계 untuk waktu.",
    );
    expect(r.mapped).toBe(2);
    expect(r.issues).toHaveLength(0);
  });

  it("works across inline formatting tags", () => {
    const r = migrateExplanationText("<p>③ <strong>여권</strong></p>", answers);
    expect(r.migrated).toBe("<p>[[pilihan:C]] <strong>여권</strong></p>");
  });

  it("skips a number without choice text instead of guessing", () => {
    const r = migrateExplanationText("정답은 ②입니다.", answers);
    expect(r.migrated).toBe("정답은 ②입니다.");
    expect(r.issues[0]?.kind).toBe("unverified");
  });

  it("flags a conflict and leaves the whole field unchanged", () => {
    const r = migrateExplanationText("① 시계 benar, ② 의자 salah", answers);
    expect(r.migrated).toBe("① 시계 benar, ② 의자 salah");
    expect(r.mapped).toBe(0);
    expect(r.issues.some((i) => i.kind === "conflict")).toBe(true);
  });

  it("never touches plain numbers (grammar, chapter, year)", () => {
    const text = "Pola 2 bab 3, soal 4번, tahun 2024: (1) 시계";
    const r = migrateExplanationText(text, answers);
    expect(r.migrated).toBe(text);
    expect(r.issues).toHaveLength(0);
  });

  it("is idempotent", () => {
    const once = migrateExplanationText("② 가방", answers).migrated;
    const twice = migrateExplanationText(once, answers);
    expect(twice.migrated).toBe(once);
    expect(twice.mapped).toBe(0);
  });
});

describe("resolveChoiceTokens", () => {
  it("numbers by the displayed (shuffled) order", () => {
    expect(resolveChoiceTokens("[[pilihan:B]] 가방", ["A", "C", "B", "D"])).toBe("③ 가방");
    expect(resolveChoiceTokens("[[pilihan:B]] 가방", ["B", "D", "A", "C"])).toBe("① 가방");
  });

  it("uses a safe fallback for a missing choice", () => {
    expect(resolveChoiceTokens("[[pilihan:D]]", ["A", "B", "C"])).toBe("(pilihan tidak tersedia)");
  });
});

describe("localizeExplanation (old snapshot, display only)", () => {
  it("renumbers verified legacy references without changing input", () => {
    const legacy = "정답 ② 가방, ❌ ④ 의자";
    expect(localizeExplanation(legacy, answers, ["D", "B", "A", "C"])).toBe("정답 ② 가방, ❌ ① 의자");
    expect(localizeExplanation(legacy, answers, ["A", "C", "B", "D"])).toBe("정답 ③ 가방, ❌ ④ 의자");
  });
});
