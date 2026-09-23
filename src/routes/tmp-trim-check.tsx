import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AudioTrimDialog } from "@/components/media";

export const Route = createFileRoute("/tmp-trim-check")({
  component: Page,
});

function Page() {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState("");
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Buka</Button>
      <p data-testid="applied">{applied}</p>
      <AudioTrimDialog
        open={open}
        source="http://localhost:8080/tone.wav"
        onCancel={() => setOpen(false)}
        onApply={(file) => {
          setOpen(false);
          setApplied(`${file.name}:${file.size}`);
        }}
      />
    </div>
  );
}
