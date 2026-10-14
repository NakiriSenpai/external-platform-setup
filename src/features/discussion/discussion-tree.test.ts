import { describe, expect, it } from "vitest";
import type { DiscussionComment } from "@/types/discussion";
import { buildDiscussionTree, displayNumberForLabel } from "./discussion-tree";

const c = (id: string, parent_id: string | null): DiscussionComment => ({
  id,
  parent_id,
  tenant_id: "t",
  exam_id: "e",
  question_id: "q",
  question_number: 1,
  answer_label: null,
  author_id: "u",
  author_name: "U",
  author_avatar: null,
  author_role: "siswa",
  body: "x",
  created_at: "2026-01-01",
  edited_at: null,
  is_deleted: false,
  can_edit: false,
  can_delete: false,
});

describe("buildDiscussionTree", () => {
  it("nests replies under their parent", () => {
    const tree = buildDiscussionTree([c("1", null), c("2", "1"), c("3", "2"), c("4", null)]);
    expect(tree.map((n) => n.id)).toEqual(["1", "4"]);
    expect(tree[0]!.replies[0]!.id).toBe("2");
    expect(tree[0]!.replies[0]!.replies[0]!.id).toBe("3");
  });
});

describe("displayNumberForLabel", () => {
  it("follows the shuffled position of the original choice", () => {
    // Siswa melihat urutan C, A, D, B → pilihan asli "A" tampil di nomor 2.
    const shuffled = [{ label: "C" }, { label: "A" }, { label: "D" }, { label: "B" }];
    expect(displayNumberForLabel(shuffled, "A")).toBe(2);
    expect(displayNumberForLabel(shuffled, "B")).toBe(4);
  });
  it("returns null for a general comment", () => {
    expect(displayNumberForLabel([{ label: "A" }], null)).toBeNull();
  });
});
