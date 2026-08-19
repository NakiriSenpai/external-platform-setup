import type { ReactNode } from "react";

export function PagePlaceholder({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <p className="text-sm text-muted-foreground md:text-base">{description}</p>
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Halaman ini masih kosong. Konten akan ditambahkan pada sprint berikutnya.
      </div>
      {children}
    </section>
  );
}
