import { type ReactNode } from "react";

/**
 * Shell Exam/Review Workspace.
 *
 * Struktur final: SATU scroll container berisi HEADER (sticky) → CONTENT → PAGINATION.
 * Pagination BUKAN sticky/fixed: ia bagian dari dokumen yang sama dan ikut scroll.
 */
export function WorkspaceShell({
  header,
  footer,
  overlay,
  contentBlurred,
  children,
}: {
  header: ReactNode;
  /** Pagination — dirender inline setelah konten, ikut scroll. */
  footer?: ReactNode;
  /** Overlay secure mode. */
  overlay?: ReactNode;
  contentBlurred?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex w-full select-none flex-col overflow-hidden bg-background text-foreground"
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
    >
      <div
        className={
          "flex min-h-0 flex-1 flex-col " +
          (contentBlurred ? "pointer-events-none select-none blur-md" : "")
        }
        aria-hidden={contentBlurred || undefined}
        inert={contentBlurred || undefined}
      >
        {/* SATU scroll container: header sticky di dalamnya, konten + pagination ikut scroll. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <header
            className="sticky top-0 z-30 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-card px-2.5 pb-2 sm:px-3.5"
            style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
          >
            {header}
          </header>

          <main className="min-w-0 p-2.5 sm:p-3.5">{children}</main>

          {footer ? (
            <div
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 pt-0.5 sm:px-3.5"
              style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>

      {overlay}
    </div>
  );
}


/**
 * Body: portrait = satu kolom (soal lalu jawaban);
 * landscape = dua kolom (soal kiri lebih lebar, jawaban kanan).
 *
 * `layout` adalah preferensi tampilan user (bukan rotasi fisik). Bila tidak
 * diberikan, layout mengikuti orientasi/ukuran viewport nyata.
 */
export function WorkspaceBody({
  question,
  answers,
  explanation,
  layout,
}: {
  question: ReactNode;
  answers: ReactNode;
  explanation?: ReactNode;
  layout?: "portrait" | "landscape";
}) {
  const columns =
    layout === "portrait"
      ? "grid-cols-1"
      : layout === "landscape"
        ? "grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
        : "grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]";

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-2.5 sm:gap-3">
      <div className={"grid min-w-0 items-start gap-2.5 sm:gap-3 " + columns}>
        <div className="min-w-0">{question}</div>
        <div className="min-w-0">{answers}</div>
      </div>

      {explanation ? <div className="min-w-0">{explanation}</div> : null}
    </div>
  );
}
