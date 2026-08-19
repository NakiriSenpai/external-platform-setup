import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireAdmin } from "@/middleware";
import { UserList } from "@/features/users/components/user-list";

export const Route = createFileRoute("/admin_/users")({
  head: () => ({
    meta: [
      { title: "Manajemen User Lembaga — I:UM 이음" },
      { name: "description", content: "Kelola guru dan siswa pada lembaga Anda." },
      { property: "og:title", content: "Manajemen User Lembaga — I:UM 이음" },
      { property: "og:description", content: "Kelola guru dan siswa pada lembaga Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  return (
    <AppLayout>
      <RequireAdmin>
        <UserList scope="admin" />
      </RequireAdmin>
    </AppLayout>
  );
}
