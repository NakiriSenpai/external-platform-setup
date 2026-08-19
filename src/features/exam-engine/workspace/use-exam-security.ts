import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Secure Mode Exam — state machine (final).
 *
 * ACTIVE → EXIT_DETECTED → SECURITY_BLOCKED → (tombol "Kembali ke Ujian") → ACTIVE
 *
 * Aturan:
 * - REF hanya dipakai sebagai latch de-duplikasi event (satu exit episode = satu violation).
 * - React STATE adalah satu-satunya sumber kebenaran untuk UI overlay & counter.
 * - Overlay TIDAK PERNAH hilang otomatis; hanya `resume()` yang menutupnya.
 * - `visibilitychange === "hidden"` adalah sinyal utama; `pagehide`/`freeze` fallback.
 * - `blur`/`focus`/`document.hasFocus()` TIDAK PERNAH membatalkan violation.
 * - Counter + status block dipersist per attempt di sessionStorage.
 *
 * TIDAK dihitung: rotasi layar, dialog internal, kontrol audio, navigasi antar soal.
 */
export const MAX_EXAM_VIOLATIONS = 3;

const STORAGE_PREFIX = "ium-exam-security:";

function storageKey(attemptId?: string) {
  return attemptId ? `${STORAGE_PREFIX}${attemptId}` : null;
}

type PersistedSecurityState = {
  violations: number;
  securityBlocked: boolean;
  pendingViolation: boolean;
};

const EMPTY_SECURITY_STATE: PersistedSecurityState = {
  violations: 0,
  securityBlocked: false,
  pendingViolation: false,
};

function readPersisted(attemptId?: string): PersistedSecurityState {
  const key = storageKey(attemptId);
  if (!key || typeof window === "undefined") return EMPTY_SECURITY_STATE;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return EMPTY_SECURITY_STATE;

    // Backward compatibility untuk value lama yang hanya berupa angka counter.
    if (!raw.trim().startsWith("{")) {
      const legacyCount = Number.parseInt(raw, 10);
      return {
        ...EMPTY_SECURITY_STATE,
        violations: Number.isFinite(legacyCount)
          ? Math.max(0, Math.min(legacyCount, MAX_EXAM_VIOLATIONS))
          : 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedSecurityState>;
    const parsedCount = Number(parsed.violations);
    const violations = Number.isFinite(parsedCount)
      ? Math.max(0, Math.min(parsedCount, MAX_EXAM_VIOLATIONS))
      : 0;
    return {
      violations,
      securityBlocked: parsed.securityBlocked === true,
      pendingViolation: parsed.pendingViolation === true,
    };
  } catch {
    return EMPTY_SECURITY_STATE;
  }
}

function persist(attemptId: string | undefined, state: PersistedSecurityState) {
  const key = storageKey(attemptId);
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* diabaikan */
  }
}

export function useExamSecurity({
  enabled,
  attemptId,
  onLimitReached,
}: {
  enabled: boolean;
  attemptId?: string;
  onLimitReached: () => void;
}) {
  const initialState = useRef(readPersisted(attemptId));
  const [violations, setViolations] = useState(initialState.current.violations);
  /** Overlay security sedang memblokir ujian (UI state, bukan ref). */
  const [securityBlocked, setSecurityBlocked] = useState(initialState.current.securityBlocked);
  /** Violation tercatat saat aplikasi di background dan belum diakui user. */
  const [pendingViolation, setPendingViolation] = useState(
    initialState.current.pendingViolation,
  );
  const [limitReached, setLimitReached] = useState(
    initialState.current.violations >= MAX_EXAM_VIOLATIONS,
  );

  const limitRef = useRef(onLimitReached);
  limitRef.current = onLimitReached;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const attemptRef = useRef(attemptId);
  attemptRef.current = attemptId;
  const countRef = useRef(initialState.current.violations);
  /** Latch de-duplikasi: true = episode baru boleh dicatat. */
  const episodeActiveRef = useRef(!initialState.current.securityBlocked);
  const limitHandledRef = useRef(false);

  // Restore seluruh state bila attempt berubah (termasuk remount/recovery Activity Android).
  useEffect(() => {
    const stored = readPersisted(attemptId);
    countRef.current = stored.violations;
    episodeActiveRef.current = !stored.securityBlocked;
    limitHandledRef.current = false;
    setViolations(stored.violations);
    setSecurityBlocked(stored.securityBlocked);
    setPendingViolation(stored.pendingViolation);
    setLimitReached(stored.violations >= MAX_EXAM_VIOLATIONS);
  }, [attemptId]);

  const registerViolation = useCallback(() => {
    if (!enabledRef.current) return;
    if (countRef.current >= MAX_EXAM_VIOLATIONS) return;
    if (!episodeActiveRef.current) return; // satu exit episode = satu violation
    episodeActiveRef.current = false;

    countRef.current += 1;
    const next = countRef.current;
    persist(attemptRef.current, {
      violations: next,
      securityBlocked: true,
      pendingViolation: true,
    });
    setViolations(next);
    setPendingViolation(true);
    setSecurityBlocked(true);

    if (next >= MAX_EXAM_VIOLATIONS) {
      setLimitReached(true);
      limitHandledRef.current = true;
      limitRef.current();
    }
  }, []);

  // Persisted 3/3 juga harus memakai submit architecture existing setelah remount.
  useEffect(() => {
    if (!enabled || violations < MAX_EXAM_VIOLATIONS || limitHandledRef.current) return;
    limitHandledRef.current = true;
    limitRef.current();
  }, [enabled, violations]);

  useEffect(() => {
    if (!enabled) return;

    const onHidden = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") return;
      registerViolation();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        registerViolation();
        return;
      }
      // Kembali ke aplikasi: JANGAN reset apa pun. Overlay tetap terbuka bila ada
      // pending violation; hanya tombol "Kembali ke Ujian" yang menutupnya.
    };

    const onBlur = () => {
      // Fallback Android/TWA ketika visibilitychange terlambat atau tidak dikirim.
      // Latch memastikan blur + hidden + pagehide + freeze tetap satu episode.
      registerViolation();
    };

    const onFocus = () => {
      // Hanya sinyal bahwa user kembali. Security block sengaja tidak diubah.
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("freeze", onHidden);
    window.addEventListener("pagehide", onHidden);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("freeze", onHidden);
      window.removeEventListener("pagehide", onHidden);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, registerViolation]);

  /** Hanya dipanggil dari tombol "Kembali ke Ujian". */
  const resume = useCallback(() => {
    persist(attemptRef.current, {
      violations: countRef.current,
      securityBlocked: false,
      pendingViolation: false,
    });
    setSecurityBlocked(false);
    setPendingViolation(false);
    episodeActiveRef.current = true;
  }, []);

  return {
    violations,
    /** Overlay tampil & konten ujian diblokir. */
    paused: securityBlocked,
    pendingViolation,
    limitReached,
    resume,
    registerViolation,
    max: MAX_EXAM_VIOLATIONS,
  };
}
