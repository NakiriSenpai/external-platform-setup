import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/types/analytics";

import { initials } from "../utils";

export function RankAvatar({
  row,
  className,
}: {
  row: Pick<LeaderboardRow, "display_name" | "avatar_url">;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-10", className)}>
      {row.avatar_url ? <AvatarImage src={row.avatar_url} alt={row.display_name} /> : null}
      <AvatarFallback className="bg-muted text-xs font-semibold">
        {initials(row.display_name)}
      </AvatarFallback>
    </Avatar>
  );
}
