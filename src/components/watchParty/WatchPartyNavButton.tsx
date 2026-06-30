"use client";

import React from "react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";
import { WatchPartyContent } from "@/components/watchParty/WatchPartyContent";

type WatchPartyNavButtonProps = {
  /** Icon-only for nav bars */
  iconOnly?: boolean;
  overHero?: boolean;
};

export default function WatchPartyNavButton({
  iconOnly = true,
  overHero = false,
}: WatchPartyNavButtonProps) {
  const { registration } = useWatchPartyNav();
  const active = Boolean(registration?.room);
  const canPlay = Boolean(registration?.canPlay);

  return (
    <Popover placement="bottom-end" offset={10}>
      <PopoverTrigger>
        <Button
          isIconOnly={iconOnly}
          variant={active ? "solid" : "light"}
          color={active ? "secondary" : "default"}
          radius="md"
          aria-label="Watch together"
          className={`h-10 w-10 min-w-10 ${
            active ? "" : overHero ? "text-white" : "text-foreground"
          }`}
        >
          <HugeiconsIcon icon={UserGroup02Icon} size={22} className="shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Watch together</h2>
        </div>
        {!canPlay || !registration ? (
          <p className="max-w-xs text-sm text-default-500">
            Open a movie or show page to start or join a watch party.
          </p>
        ) : (
          <WatchPartyContent
            compact
            room={registration.room}
            isHost={registration.isHost}
            loading={registration.loading}
            error={registration.error}
            nickname={registration.nickname}
            mediaType={registration.mediaType}
            onCreate={registration.onCreate}
            onJoin={registration.onJoin}
            onLeave={registration.onLeave}
            onSendChat={registration.onSendChat}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
