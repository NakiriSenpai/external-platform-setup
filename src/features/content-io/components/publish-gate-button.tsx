import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSetExamStatus } from "@/hooks/exam";
import { useSetLessonStatus } from "@/hooks/lesson";
import { publishContent } from "@/lib/publish/publish.functions";
import { recordContentIoAudit } from "@/services/content/bundle/audit.service";
import {
  validateExam,
  validateLesson,
  type ValidationReport,
} from "@/services/content/bundle/bundle-validation.service";
import { ValidationReportDialog } from "./validation-report-dialog";


/** Tombol publish dengan validasi konten wajib (ERROR memblok publish). */
export function PublishGateButton({
  kind,
  entityId,
  isPublished,
  label,
  variant = "button",
}: {
  kind: "exam" | "lesson";
  entityId: string;
  isPublished: boolean;
  label: string;
  /** "switch" menampilkan toggle ringkas dengan alur validasi yang sama. */
  variant?: "button" | "switch";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const queryClient = useQueryClient();
  const publishFn = useServerFn(publishContent);
  const setExamStatus = useSetExamStatus();
  const setLessonStatus = useSetLessonStatus();

  // Kembali ke draft (unpublish) TIDAK pernah memicu notifikasi.
  const unpublish = async () => {
    try {
      if (kind === "exam") {
        await setExamStatus.mutateAsync({ id: entityId, status: "draft" });
      } else {
        await setLessonStatus.mutateAsync({ id: entityId, status: "draft" });
      }
      toast.success(`${label} dikembalikan ke draft.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status konten.");
    }
  };


  const runValidation = async () => {
    setOpen(true);
    setLoading(true);
    setReport(null);
    try {
      const result = kind === "exam" ? await validateExam(entityId) : await validateLesson(entityId);
      setReport(result);
      if (!result.canPublish) {
        void recordContentIoAudit({
          action: "publish_blocked",
          entity: `${kind}:${entityId}`,
          count: result.errorCount,
          result: "blocked",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memvalidasi konten.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    try {
      await publishFn({ data: { kind, id: entityId } });
      void queryClient.invalidateQueries({ queryKey: kind === "exam" ? ["exams"] : ["lessons"] });
      void queryClient.invalidateQueries({ queryKey: [kind] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`${label} berhasil dipublish.`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mempublish konten.");
    }

  };

  return (
    <>
      {variant === "switch" ? (
        <div className="flex items-center gap-2">
          <Switch
            aria-label={isPublished ? `Kembalikan ${label} ke draft` : `Publish ${label}`}
            checked={isPublished}
            disabled={setExamStatus.isPending || setLessonStatus.isPending}
            onCheckedChange={(next) => (next ? void runValidation() : void unpublish())}
          />
          <span className="text-xs text-muted-foreground">
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>
      ) : (
        <>
          <Button
            size="sm"
            variant={isPublished ? "outline" : "default"}
            className="min-h-11"
            onClick={() => void runValidation()}
          >
            <ShieldCheck className="mr-1 size-4" />
            {isPublished ? "Validasi ulang" : "Validasi & Publish"}
          </Button>
          {isPublished ? (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              disabled={setExamStatus.isPending || setLessonStatus.isPending}
              onClick={() => void unpublish()}
            >
              <Undo2 className="mr-1 size-4" />
              Kembalikan ke draft
            </Button>
          ) : null}
        </>
      )}
      <ValidationReportDialog
        open={open}
        onOpenChange={setOpen}
        title={`Validasi ${label}`}
        report={report}
        loading={loading}
        onConfirm={() => void publish()}
      />
    </>
  );
}
