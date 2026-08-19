import { createFileRoute } from "@tanstack/react-router";

import { LeaderboardView } from "@/features/leaderboard/components/leaderboard-view";
import { AppLayout } from "@/layouts/app-layout";
import { RequireAuth } from "@/middleware";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Peringkat — I:UM 이음" },
      {
        name: "description",
        content: "Papan peringkat peserta pelatihan berdasarkan nilai ujian.",
      },
      { property: "og:title", content: "Peringkat — I:UM 이음" },
      {
        property: "og:description",
        content: "Papan peringkat peserta pelatihan berdasarkan nilai ujian.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <AppLayout>
      <RequireAuth>
        <LeaderboardView />
      </RequireAuth>
    </AppLayout>
  );
}
