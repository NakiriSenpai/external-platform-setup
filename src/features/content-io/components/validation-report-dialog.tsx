import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ValidationReport } from "@/services/content/bundle/bundle-validation.service";

/** Gate publish: ERROR memblok, WARNING hanya memberi peringatan. */
export function ValidationReportDialog({
  open,
  onOpenChange,
  title,
  report,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  report: ValidationReport | null;
  loading: boolean;
  onConfirm: () => void;
}) {
  const errors = report?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = report?.issues.filter((i) => i.severity === "warning") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Konten diperiksa sebelum dipublish agar siswa tidak menerima materi rusak.
          </DialogDescription>
        </DialogHeader>

        {loading || !report ? (
          <p className="py-6 text-sm text-muted-foreground">Memeriksa konten…</p>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {report.checks.map((check) => (
                <li key={check.label} className="flex items-center gap-2 text-sm">
                  {check.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>

            {errors.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">
                  {errors.length} masalah harus diperbaiki
                </p>
                <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-destructive">
                  {errors.map((issue, index) => (
                    <li key={index}>
                      <span className="font-medium">{issue.scope}</span> — {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  {warnings.length} peringatan (tidak memblok publish)
                </p>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-300">
                  {warnings.map((issue, index) => (
                    <li key={index}>
                      <span className="font-medium">{issue.scope}</span> — {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            className="min-h-11"
            disabled={loading || !report?.canPublish}
            onClick={onConfirm}
          >
            Publish sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
