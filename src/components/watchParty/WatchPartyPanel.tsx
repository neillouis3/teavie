"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import type { WatchPartyContentProps } from "@/components/watchParty/WatchPartyContent";
import { WatchPartyContent } from "@/components/watchParty/WatchPartyContent";

type WatchPartyPanelProps = WatchPartyContentProps;

export default function WatchPartyPanel(props: WatchPartyPanelProps) {
  const [open, setOpen] = useState(false);
  const { room } = props;

  if (!open && !room) {
    return (
      <div className="mb-3">
        <Button
          size="sm"
          color="secondary"
          variant="flat"
          onPress={() => setOpen(true)}
        >
          Watch together
        </Button>
      </div>
    );
  }

  return (
    <section className="mb-4 rounded-xl border border-default-200 bg-content1/80 p-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Watch together</h2>
        {room ? null : (
          <Button size="sm" variant="light" onPress={() => setOpen(false)}>
            Close
          </Button>
        )}
      </div>
      <WatchPartyContent {...props} />
    </section>
  );
}
