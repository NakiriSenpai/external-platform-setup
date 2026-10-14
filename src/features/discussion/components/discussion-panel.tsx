import { useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Pencil, Reply, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteComment,
  useEditComment,
  useExamDiscussion,
  usePostComment,
} from "@/hooks/discussion/use-discussion";
import { cn } from "@/lib/utils";
import type { DiscussionNode } from "@/types/discussion";
import { buildDiscussionTree, displayNumberForLabel } from "../discussion-tree";

const EMOJI = ["👍", "🙏", "😊", "😂", "🤔", "😮", "😢", "🔥", "💯", "✅", "❌", "❤️"];
const MAX_DEPTH = 3;

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type AnswerTarget = { label: "A" | "B" | "C" | "D"; number: number };

type Props = {
  examId: string;
  questionId: string;
  /** Urutan pilihan yang dilihat user (snapshot attempt) — untuk nomor tampilan. */
  answers?: readonly { label: string }[];
  /** Komentar khusus pilihan (dipilih dari "Komentari pilihan ini"). */
  answerTarget?: AnswerTarget | null;
  onClearAnswerTarget?: () => void;
  tenantId?: string | null;
};

/** Diskusi Soal: thread per tenant + exam + question_id (bukan nomor tampil). */
export function DiscussionPanel({
  examId,
  questionId,
  answers = [],
  answerTarget,
  onClearAnswerTarget,
  tenantId,
}: Props) {
  const { data, isLoading, isError, error, refetch } = useExamDiscussion({
    examId,
    questionId,
    tenantId,
  });
  const tree = useMemo(() => buildDiscussionTree(data ?? []), [data]);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" aria-label="Diskusi soal">
      <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary">
        <MessageCircle className="size-4" /> Diskusi Soal
        {data && data.length > 0 ? (
          <span className="ml-auto font-medium normal-case text-muted-foreground">
            {data.length} komentar
          </span>
        ) : null}
      </p>
      <div className="space-y-3 p-3 sm:p-4">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat diskusi…
          </p>
        ) : isError ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{error instanceof Error ? error.message : "Gagal memuat diskusi."}</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <>
            {tree.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada diskusi. Mulai bertanya!</p>
            ) : (
              <ul className="space-y-3">
                {tree.map((node) => (
                  <CommentItem
                    key={node.id}
                    node={node}
                    depth={0}
                    examId={examId}
                    questionId={questionId}
                    answers={answers}
                    tenantId={tenantId}
                  />
                ))}
              </ul>
            )}
            <Composer
              examId={examId}
              questionId={questionId}
              tenantId={tenantId}
              answerTarget={answerTarget}
              onClearAnswerTarget={onClearAnswerTarget}
            />
          </>
        )}
      </div>
    </section>
  );
}

function CommentItem({
  node,
  depth,
  examId,
  questionId,
  answers,
  tenantId,
}: {
  node: DiscussionNode;
  depth: number;
  examId: string;
  questionId: string;
  answers: readonly { label: string }[];
  tenantId?: string | null;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.body);
  const edit = useEditComment();
  const remove = useDeleteComment();
  const choiceNumber = displayNumberForLabel(answers, node.answer_label);

  const saveEdit = () => {
    if (!draft.trim() || edit.isPending) return;
    edit.mutate(
      { id: node.id, body: draft },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Komentar diperbarui.");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengedit."),
      },
    );
  };

  const doDelete = () => {
    if (remove.isPending || !window.confirm("Hapus komentar ini?")) return;
    remove.mutate(node.id, {
      onSuccess: () => toast.success("Komentar dihapus."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus."),
    });
  };

  return (
    <li className="space-y-2">
      <div className="flex min-w-0 gap-2">
        <Avatar className="size-8 shrink-0">
          {node.author_avatar ? <AvatarImage src={node.author_avatar} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {node.author_name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="font-semibold text-foreground">{node.author_name}</span>
              {node.author_role && node.author_role !== "siswa" ? (
                <span className="rounded bg-primary/10 px-1.5 text-[10px] uppercase text-primary">
                  {node.author_role}
                </span>
              ) : null}
              <span className="text-muted-foreground">
                {formatTime(node.created_at)}
                {node.edited_at ? " · diedit" : ""}
              </span>
            </p>
            {node.answer_label && !node.parent_id ? (
              <p className="mt-1 text-[11px] font-medium text-primary">
                Tentang pilihan {choiceNumber ?? node.answer_label}
              </p>
            ) : null}
            {node.is_deleted ? (
              <p className="mt-1 text-sm italic text-muted-foreground">Komentar telah dihapus.</p>
            ) : editing ? (
              <div className="mt-1 space-y-2">
                <Textarea
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-16 text-sm"
                  aria-label="Edit komentar"
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!draft.trim() || edit.isPending} onClick={saveEdit}>
                    {edit.isPending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                    Simpan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setDraft(node.body);
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              // Teks polos: React meng-escape seluruh konten (anti XSS).
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                {node.body}
              </p>
            )}
          </div>
          {!node.is_deleted && !editing ? (
            <div className="flex flex-wrap gap-1 text-xs">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setReplying((v) => !v)}
              >
                <Reply className="mr-1 size-3.5" /> Balas
              </Button>
              {node.can_edit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1 size-3.5" /> Edit
                </Button>
              ) : null}
              {node.can_delete ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive"
                  disabled={remove.isPending}
                  onClick={doDelete}
                >
                  <Trash2 className="mr-1 size-3.5" /> Hapus
                </Button>
              ) : null}
            </div>
          ) : null}
          {replying ? (
            <Composer
              examId={examId}
              questionId={questionId}
              tenantId={tenantId}
              parentId={node.id}
              replyTo={node.author_name}
              onDone={() => setReplying(false)}
            />
          ) : null}
        </div>
      </div>
      {node.replies.length > 0 ? (
        <ul
          className={cn(
            "space-y-2 border-l border-border",
            depth < MAX_DEPTH ? "ml-4 pl-3 sm:ml-6" : "ml-0 pl-2",
          )}
        >
          {node.replies.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              examId={examId}
              questionId={questionId}
              answers={answers}
              tenantId={tenantId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Composer({
  examId,
  questionId,
  tenantId,
  parentId,
  replyTo,
  answerTarget,
  onClearAnswerTarget,
  onDone,
}: {
  examId: string;
  questionId: string;
  tenantId?: string | null;
  parentId?: string;
  replyTo?: string;
  answerTarget?: AnswerTarget | null;
  onClearAnswerTarget?: () => void;
  onDone?: () => void;
}) {
  const [body, setBody] = useState("");
  // Satu ID per draft: klik ganda / retry tidak membuat komentar duplikat.
  const requestId = useRef(newRequestId());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const post = usePostComment();

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) return setBody((b) => b + emoji);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + emoji + body.slice(end));
  };

  const submit = () => {
    if (!body.trim() || post.isPending) return;
    post.mutate(
      {
        examId,
        questionId,
        body,
        clientRequestId: requestId.current,
        parentId: parentId ?? null,
        answerLabel: parentId ? null : (answerTarget?.label ?? null),
        tenantId,
      },
      {
        onSuccess: () => {
          setBody("");
          requestId.current = newRequestId();
          onClearAnswerTarget?.();
          onDone?.();
          toast.success(parentId ? "Balasan terkirim." : "Komentar terkirim.");
        },
        // ID permintaan dipertahankan agar retry tetap idempoten.
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengirim."),
      },
    );
  };

  return (
    <div className="space-y-2">
      {answerTarget && !parentId ? (
        <p className="flex items-center gap-2 text-xs text-primary">
          Mengomentari pilihan {answerTarget.number}
          <button
            type="button"
            aria-label="Batalkan komentar pilihan"
            className="rounded p-0.5 hover:bg-muted"
            onClick={onClearAnswerTarget}
          >
            <X className="size-3.5" />
          </button>
        </p>
      ) : null}
      <Textarea
        ref={textareaRef}
        value={body}
        maxLength={2000}
        onChange={(e) => setBody(e.target.value)}
        placeholder={replyTo ? `Balas ${replyTo}…` : "Tulis komentar…"}
        aria-label={replyTo ? `Balas ${replyTo}` : "Tulis komentar"}
        className="min-h-16 text-sm"
      />
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost" aria-label="Tambah emoji" className="size-9">
              <Smile className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="grid w-auto grid-cols-6 gap-1 p-2">
            {EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="grid size-9 place-items-center rounded-md text-lg hover:bg-muted"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <span className="text-[11px] text-muted-foreground">{body.length}/2000</span>
        <div className="ml-auto flex gap-2">
          {onDone ? (
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              Batal
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={!body.trim() || post.isPending} onClick={submit}>
            {post.isPending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Kirim
          </Button>
        </div>
      </div>
    </div>
  );
}
