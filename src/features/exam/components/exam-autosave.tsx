import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import type { AutosaveStatus } from "@/hooks/use-autosave";
import { cn } from "@/lib/utils";

type Ctx = {
  /** Lapor status autosave dari sebuah form (detail exam, soal, dll). */
  report: (id: string, status: AutosaveStatus) => void;
  /** Daftarkan fungsi flush agar bisa dipanggil sebelum keluar/preview. */
  registerFlush: (id: string, flush: () => Promise<void>) => () => void;
  /** Jalankan semua flush yang terdaftar. */
  flushAll: () => Promise<void>;
};

const AutosaveContext = createContext<Ctx | null>(null);

/** Provider status autosave untuk seluruh halaman Edit Exam. */
export function ExamAutosaveProvider({
  children,
  onStatusChange,
}: {
  children: ReactNode;
  onStatusChange: (status: AutosaveStatus) => void;
}) {
  const statuses = useRef(new Map<string, AutosaveStatus>());
  const flushes = useRef(new Map<string, () => Promise<void>>());
  const notify = useRef(onStatusChange);
  notify.current = onStatusChange;

  const report = useCallback((id: string, status: AutosaveStatus) => {
    statuses.current.set(id, status);
    const all = [...statuses.current.values()];
    const next: AutosaveStatus = all.includes("error")
      ? "error"
      : all.includes("saving") || all.includes("pending")
        ? "saving"
        : all.includes("saved")
          ? "saved"
          : "idle";
    notify.current(next);
  }, []);

  const registerFlush = useCallback((id: string, flush: () => Promise<void>) => {
    flushes.current.set(id, flush);
    return () => {
      flushes.current.delete(id);
      statuses.current.delete(id);
    };
  }, []);

  const flushAll = useCallback(async () => {
    await Promise.all([...flushes.current.values()].map((fn) => fn().catch(() => undefined)));
  }, []);

  const value = useMemo(
    () => ({ report, registerFlush, flushAll }),
    [report, registerFlush, flushAll],
  );

  return <AutosaveContext.Provider value={value}>{children}</AutosaveContext.Provider>;
}

/** Akses context autosave (aman dipakai di luar provider). */
export function useExamAutosaveContext() {
  return useContext(AutosaveContext);
}

/**
 * Hubungkan satu instance useAutosave ke indikator global halaman Edit Exam.
 */
export function useReportAutosave(id: string, status: AutosaveStatus, flush: () => Promise<void>) {
  const ctx = useExamAutosaveContext();
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!ctx) return;
    return ctx.registerFlush(id, () => flushRef.current());
  }, [ctx, id]);

  useEffect(() => {
    ctx?.report(id, status);
  }, [ctx, id, status]);
}

/** Indikator "Tersimpan / Menyimpan… / Gagal menyimpan" pada header editor. */
export function AutosaveIndicator({
  status,
  className,
}: {
  status: AutosaveStatus;
  className?: string;
}) {
  if (status === "idle") return null;
  const map = {
    pending: { text: "Menyimpan…", tone: "text-muted-foreground", Icon: Loader2, spin: true },
    saving: { text: "Menyimpan…", tone: "text-muted-foreground", Icon: Loader2, spin: true },
    saved: { text: "Tersimpan", tone: "text-success", Icon: Check, spin: false },
    error: { text: "Gagal menyimpan", tone: "text-destructive", Icon: AlertTriangle, spin: false },
  } as const;
  const item = map[status];
  const { Icon } = item;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        item.tone,
        className,
      )}
    >
      <Icon className={cn("size-3.5", item.spin && "animate-spin")} />
      {item.text}
    </span>
  );
}

/** Status gabungan untuk halaman Edit Exam. */
export function useExamAutosaveStatus() {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  return { status, setStatus };
}
