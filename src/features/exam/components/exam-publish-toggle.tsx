import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSetExamStatus } from "@/hooks/exam";
import { publishContent } from "@/lib/publish/publish.functions";

type Props = {
  examId: string;
  isPublished: boolean;
  /** "compact" untuk daftar exam, "full" untuk header/area status editor. */
  size?: "compact" | "full";
};

/**
 * Toggle publikasi exam: DRAFT ⇄ PUBLISHED tanpa langkah validasi.
 * Publish memakai server function (tenant/ownership tetap diverifikasi di server),
 * kembali ke draft memakai mutation existing yang tunduk pada RLS.
 */
export function ExamPublishToggle({ examId, isPublished, size = "compact" }: Props) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const publishFn = useServerFn(publishContent);
  const setExamStatus = useSetExamStatus();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["exams"] });
    void queryClient.invalidateQueries({ queryKey: ["exam"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const publish = async () => {
    setLoading(true);
    try {
      await publishFn({ data: { kind: "exam", id: examId } });
      invalidate();
      toast.success("Exam dipublish.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mempublish exam.");
    } finally {
      setLoading(false);
    }
  };

  const unpublish = async () => {
    setLoading(true);
    try {
      await setExamStatus.mutateAsync({ id: examId, status: "draft" });
      toast.success("Exam dikembalikan ke draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status exam.");
    } finally {
      setLoading(false);
    }
  };

  const pending = loading || setExamStatus.isPending;

  return (
    <Button
      type="button"
      size="sm"
      variant={isPublished ? "outline" : "default"}
      disabled={pending}
      className={size === "full" ? "min-h-11 w-full" : "min-h-9"}
      onClick={() => void (isPublished ? unpublish() : publish())}
    >
      {pending ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : isPublished ? (
        <Undo2 className="mr-1 size-4" />
      ) : (
        <Send className="mr-1 size-4" />
      )}
      {isPublished ? "Kembalikan ke Draft" : "Publish"}
    </Button>
  );
}
