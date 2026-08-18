"use client";

import React from "react";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleTea01Icon } from "@hugeicons/core-free-icons";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";
import { WATCH_TOOLBAR_BUTTON_CLASS } from "@/lib/watchChrome";
import { cn } from "@/lib/utils";

/** Tea Party control for immersive watch chrome (nav is hidden on watch pages). */
export default function TeaPartyWatchButton() {
  const { registration, openTeaParty } = useWatchPartyNav();
  if (!registration?.canPlay) return null;

  const active = Boolean(registration.room);

  return (
    <Button
      isIconOnly
      size="sm"
      variant="light"
      radius="md"
      aria-label="Tea Party"
      onPress={openTeaParty}
      className={cn(
        WATCH_TOOLBAR_BUTTON_CLASS,
        "ml-auto min-w-11 px-0 text-white",
        active && "text-success"
      )}
    >
      <HugeiconsIcon icon={BubbleTea01Icon} size={18} className="shrink-0" />
    </Button>
  );
}
