"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { avatarInitials, getStoredPartyNickname } from "@/lib/partyNickname";

const NICK_CHANGED = "teavie-party-nickname-changed";

export default function ProfileNavAvatar() {
  const [nickname, setNickname] = useState("Guest");

  useEffect(() => {
    const refresh = () => setNickname(getStoredPartyNickname());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(NICK_CHANGED, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(NICK_CHANGED, refresh);
    };
  }, []);

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          type="button"
          className="inline-flex shrink-0 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success"
          aria-label="Profile menu"
        >
          <Avatar
            size="sm"
            name={nickname}
            getInitials={() => avatarInitials(nickname)}
            classNames={{
              base: "bg-success/20 text-success",
              name: "text-xs font-semibold",
            }}
          />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Profile actions">
        <DropdownItem
          key="settings"
          href="/settings"
          as={Link}
          startContent={
            <HugeiconsIcon icon={Settings01Icon} size={16} className="shrink-0" />
          }
        >
          Settings
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
