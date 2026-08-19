import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { BrandingForm } from "@/features/settings/components/branding-form";
import { FeatureFlagList } from "@/features/settings/components/feature-flag-list";
import { MaintenanceCard } from "@/features/settings/components/maintenance-card";
import { ReleaseChecklist } from "@/features/settings/components/release-checklist";

export const Route = createFileRoute("/owner_/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan Platform — I:UM 이음" },
      {
        name: "description",
        content:
          "Atur branding white label, feature flag, mode pemeliharaan, dan kesiapan rilis platform.",
      },
      { property: "og:title", content: "Pengaturan Platform — I:UM 이음" },
      {
        property: "og:description",
        content: "Branding, feature flag, mode pemeliharaan, dan audit kesiapan rilis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerSettingsPage,
});

function OwnerSettingsPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <section className="space-y-6">
          <header className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Pengaturan Platform</h1>
            <p className="text-sm text-muted-foreground">
              White label, feature flag, mode pemeliharaan, dan kesiapan rilis.
            </p>
          </header>

          <BrandingForm />
          <FeatureFlagList />
          <MaintenanceCard />
          <ReleaseChecklist />
        </section>
      </RequireOwner>
    </AppLayout>
  );
}
