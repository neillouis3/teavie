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
import { Settings01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import {
  avatarInitials,
  getStoredPartyNickname,
  PARTY_NICKNAME_CHANGED_EVENT,
} from "@/lib/partyNickname";

export default function ProfileNavAvatar() {
  const [nickname, setNickname] = useState("Guest");

  useEffect(() => {
    const refresh = () => setNickname(getStoredPartyNickname());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(PARTY_NICKNAME_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PARTY_NICKNAME_CHANGED_EVENT, refresh);
    };
  }, []);

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success"
          aria-label="Profile menu"
        >
          <Avatar
            size="sm"
            name={nickname}
            getInitials={() => avatarInitials(nickname)}
            classNames={{
              base: "h-10 w-10 bg-success/20 text-success",
              name: "text-sm font-semibold",
            }}
          />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Profile actions">
        <DropdownItem
          key="profile"
          href="/profile"
          as={Link}
          startContent={
            <HugeiconsIcon icon={UserCircleIcon} size={16} className="shrink-0" />
          }
        >
          Profile
        </DropdownItem>
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
