import { useEffect } from "react";

/** ANTI COPY — hanya aktif selama Exam Workspace terpasang. */
export function useAntiCopy() {
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(el?.closest?.("input, textarea, [contenteditable='true']"));
    };
    const block = (event: Event) => {
      if (isEditable(event.target)) return;
      event.preventDefault();
    };
    const events = ["copy", "cut", "paste", "contextmenu", "dragstart", "selectstart"];
    events.forEach((name) => document.addEventListener(name, block));
    return () => events.forEach((name) => document.removeEventListener(name, block));
  }, []);
}
