export type AudioDebugEntry = {
  at: string;
  stage: string;
  detail: string;
};

const STORAGE_KEY = "ium:audio-debug:v1";
const EVENT_NAME = "ium:audio-debug";
const MAX_ENTRIES = 40;

function readStored(): AudioDebugEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
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
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export const AUDIO_DEBUG_EVENT = EVENT_NAME;