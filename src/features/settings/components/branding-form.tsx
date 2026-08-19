import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppConfig } from "@/hooks/config";
import { brandingSchema, firstIssue } from "@/lib/config/validation";
import { updateBranding } from "@/services/config";
import type { BrandingInput } from "@/types/config";
import { z } from "zod";

type FormState = {
  appName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginBranding: string;
  supportEmail: string;
};

/** Form white label: nama, logo, warna, dan teks halaman masuk. */
export function BrandingForm() {
  const { config, refresh } = useAppConfig();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    appName: config.appName,
    shortName: config.shortName,
    tagline: config.tagline,
    logoUrl: config.logoUrl ?? "",
    faviconUrl: config.faviconUrl ?? "",
    primaryColor: config.primaryColor ?? "",
    secondaryColor: config.secondaryColor ?? "",
    accentColor: config.accentColor ?? "",
    loginBranding: config.loginBranding ?? "",
    supportEmail: config.supportEmail ?? "",
  });

  useEffect(() => {
    setForm({
      appName: config.appName,
      shortName: config.shortName,
      tagline: config.tagline,
      logoUrl: config.logoUrl ?? "",
      faviconUrl: config.faviconUrl ?? "",
      primaryColor: config.primaryColor ?? "",
      secondaryColor: config.secondaryColor ?? "",
      accentColor: config.accentColor ?? "",
      loginBranding: config.loginBranding ?? "",
      supportEmail: config.supportEmail ?? "",
    });
  }, [config]);

  const mutation = useMutation({
    mutationFn: (payload: BrandingInput) => updateBranding(payload),
    onSuccess: async () => {
      toast.success("Branding tersimpan.");
      queryClient.setQueryData(["app-config"], undefined);
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = brandingSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(firstIssue(parsed.error as z.ZodError));
      return;
    }
    mutation.mutate(parsed.data as BrandingInput);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Branding aplikasi</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama aplikasi" id="appName">
              <Input
                id="appName"
                value={form.appName}
                onChange={(e) => set("appName")(e.target.value)}
                maxLength={60}
                className="min-h-11"
              />
            </Field>
            <Field label="Nama pendek" id="shortName">
              <Input
                id="shortName"
                value={form.shortName}
                onChange={(e) => set("shortName")(e.target.value)}
                maxLength={20}
                className="min-h-11"
              />
            </Field>
          </div>

          <Field label="Tagline" id="tagline">
            <Textarea
              id="tagline"
              value={form.tagline}
              onChange={(e) => set("tagline")(e.target.value)}
              maxLength={160}
              rows={2}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL logo" id="logoUrl">
              <Input
                id="logoUrl"
                value={form.logoUrl}
                onChange={(e) => set("logoUrl")(e.target.value)}
                placeholder="https://…"
                className="min-h-11"
              />
            </Field>
            <Field label="URL favicon" id="faviconUrl">
              <Input
                id="faviconUrl"
                value={form.faviconUrl}
                onChange={(e) => set("faviconUrl")(e.target.value)}
                placeholder="https://…"
                className="min-h-11"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField
              id="primaryColor"
              label="Warna utama"
              value={form.primaryColor}
              onChange={set("primaryColor")}
            />
            <ColorField
              id="secondaryColor"
              label="Warna sekunder"
              value={form.secondaryColor}
              onChange={set("secondaryColor")}
            />
            <ColorField
              id="accentColor"
              label="Warna aksen"
              value={form.accentColor}
              onChange={set("accentColor")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Kosongkan warna untuk memakai tema bawaan aplikasi.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teks halaman masuk" id="loginBranding">
              <Input
                id="loginBranding"
                value={form.loginBranding}
                onChange={(e) => set("loginBranding")(e.target.value)}
                maxLength={200}
                className="min-h-11"
              />
            </Field>
            <Field label="Email dukungan" id="supportEmail">
              <Input
                id="supportEmail"
                type="email"
                value={form.supportEmail}
                onChange={(e) => set("supportEmail")(e.target.value)}
                className="min-h-11"
              />
            </Field>
          </div>

          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan…" : "Simpan branding"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Pilih ${label}`}
          value={isHex ? value : "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 rounded-md border border-input bg-transparent"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className="min-h-11"
        />
      </div>
    </div>
  );
}
