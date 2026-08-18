"use client";

import React from "react";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleTea01Icon } from "@hugeicons/core-free-icons";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";

type WatchPartyNavButtonProps = {
  /** Icon-only for nav bars */
  iconOnly?: boolean;
  overHero?: boolean;
};

export default function WatchPartyNavButton({
  iconOnly = true,
  overHero = false,
}: WatchPartyNavButtonProps) {
  const { registration, openTeaParty } = useWatchPartyNav();
  const active = Boolean(registration?.room);

  return (
    <Button
      isIconOnly={iconOnly}
      variant={active ? "solid" : "light"}
      color={active ? "success" : "default"}
      radius="md"
      aria-label="Tea Party"
      onPress={openTeaParty}
      className={`h-10 w-10 min-w-10 ${
        active ? "" : overHero ? "text-white" : "text-foreground"
      }`}
    >
      <HugeiconsIcon icon={BubbleTea01Icon} size={22} className="shrink-0" />
    </Button>
  );
}
