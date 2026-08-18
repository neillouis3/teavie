"use client";

import React from "react";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleTea01Icon } from "@hugeicons/core-free-icons";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";

/** Tea Party control for immersive watch chrome (nav is hidden on watch pages). */
export default function TeaPartyWatchButton() {
  const { registration, openTeaParty } = useWatchPartyNav();
  if (!registration?.canPlay) return null;

  const active = Boolean(registration.room);

  return (
    <Button
      isIconOnly
      variant={active ? "solid" : "flat"}
      color={active ? "success" : "default"}
      radius="md"
      aria-label="Tea Party"
      onPress={openTeaParty}
      className={`h-9 w-9 min-w-9 shrink-0 ${
        active ? "" : "bg-black/40 text-white backdrop-blur-md"
      }`}
    >
      <HugeiconsIcon icon={BubbleTea01Icon} size={20} className="shrink-0" />
    </Button>
  );
}
