import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { UserList } from "@/features/users/components/user-list";

export const Route = createFileRoute("/owner_/users")({
  head: () => ({
    meta: [
      { title: "Manajemen User — I:UM 이음" },
      { name: "description", content: "Kelola seluruh pengguna pada semua tenant I:UM 이음." },
      { property: "og:title", content: "Manajemen User — I:UM 이음" },
      {
        property: "og:description",
        content: "Kelola seluruh pengguna pada semua tenant I:UM 이음.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerUsersPage,
});

function OwnerUsersPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <UserList scope="owner" />
      </RequireOwner>
    </AppLayout>
  );
}
