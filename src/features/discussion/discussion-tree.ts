import type { DiscussionComment, DiscussionNode } from "@/types/discussion";

/** Susun komentar datar menjadi thread bertingkat (urutan kronologis dipertahankan). */
export function buildDiscussionTree(comments: readonly DiscussionComment[]): DiscussionNode[] {
  const nodes = new Map<string, DiscussionNode>();
  for (const c of comments) nodes.set(c.id, { ...c, replies: [] });
  const roots: DiscussionNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    const parent = c.parent_id ? nodes.get(c.parent_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Nomor tampilan pilihan untuk label asli pada urutan yang dilihat user. */
export function displayNumberForLabel(
  answers: readonly { label: string }[],
  label: string | null,
): number | null {
  if (!label) return null;
  const index = answers.findIndex((a) => a.label === label);
  return index < 0 ? null : index + 1;
}
