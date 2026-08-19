export type AudioDebugEntry = {
  at: string;
  stage: string;
  detail: string;
};

const STORAGE_KEY = "ium:audio-debug:v1";
const PICKER_PENDING_KEY = "ium:audio-picker-pending:v1";
const EVENT_NAME = "ium:audio-debug";
const MAX_ENTRIES = 40;

function readStored(): AudioDebugEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as AudioDebugEntry[]) : [];
  } catch {
    return [];
  }
}

/** Diagnostic audio non-sensitive yang bertahan saat Android membuka Storage. */
export function audioDebug(stage: string, detail: string): void {
  const entry: AudioDebugEntry = { at: new Date().toISOString(), stage, detail };
  console.info(`[AUDIO DEBUG] ${stage} — ${detail}`);
  if (typeof window === "undefined") return;
  const entries = [...readStored(), entry].slice(-MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Console logging tetap tersedia bila storage browser dibatasi.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: entry }));
}

export function readAudioDebug(): AudioDebugEntry[] {
  return readStored();
}

export function clearAudioDebug(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export const AUDIO_DEBUG_EVENT = EVENT_NAME;

export function markAudioPickerPending(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PICKER_PENDING_KEY,
    JSON.stringify({ at: new Date().toISOString(), documentId: getAudioDocumentId() }),
  );
}

export function clearAudioPickerPending(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PICKER_PENDING_KEY);
}

export function readAudioPickerPending(): { at: string; documentId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(PICKER_PENDING_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    return typeof candidate["at"] === "string" && typeof candidate["documentId"] === "string"
      ? { at: candidate["at"], documentId: candidate["documentId"] }
      : null;
  } catch {
    return null;
  }
}

let documentId: string | null = null;
export function getAudioDocumentId(): string {
  if (!documentId) documentId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return documentId;
}