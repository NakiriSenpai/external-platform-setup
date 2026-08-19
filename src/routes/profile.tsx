import { createFileRoute } from "@tanstack/react-router";

import { ProfileView } from "@/features/profile/components/profile-view";
import { AppLayout } from "@/layouts/app-layout";
import { RequireAuth } from "@/middleware";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profil Saya — I:UM 이음" },
      { name: "description", content: "Kelola informasi akun, foto profil, keamanan, dan tema." },
      { property: "og:title", content: "Profil Saya — I:UM 이음" },
      {
        property: "og:description",
        content: "Kelola informasi akun, foto profil, keamanan, dan tema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppLayout>
      <RequireAuth>
        <ProfileView />
      </RequireAuth>
    </AppLayout>
  );
}

