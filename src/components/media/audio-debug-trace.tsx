import { useEffect, useState } from "react";

import {
  AUDIO_DEBUG_EVENT,
  readAudioDebug,
  type AudioDebugEntry,
} from "@/lib/media/audio-debug";

/** Trace yang dapat dibaca langsung dari APK tanpa remote DevTools. */
export function AudioDebugTrace() {
  const [entries, setEntries] = useState<AudioDebugEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(readAudioDebug());
    refresh();
    window.addEventListener(AUDIO_DEBUG_EVENT, refresh);
    return () => window.removeEventListener(AUDIO_DEBUG_EVENT, refresh);
  }, []);

  if (entries.length === 0) return null;

  return (
    <details className="w-full max-w-full text-left" open>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Audio debug ({entries.length})
      </summary>
      <ol className="mt-1 max-h-40 space-y-1 overflow-auto rounded-md border border-border bg-background p-2 text-[10px] text-muted-foreground">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="break-words">
            <strong className="text-foreground">[AUDIO DEBUG] {entry.stage}</strong> {entry.detail}
          </li>
        ))}
      </ol>
    </details>
  );
}