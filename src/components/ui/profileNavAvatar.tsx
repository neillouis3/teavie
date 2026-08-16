"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChartLineData01Icon,
  Logout01Icon,
  Settings01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { avatarInitials } from "@/lib/partyNickname";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/authContext";
import AssetMaskIcon from "@/components/ui/assetMaskIcon";
import { MENU_GLASS_CLASS, NAV_MENU_ITEM_CLASS, NAV_MENU_ITEM_DANGER_CLASS } from "@/components/ui/navGlass";

export default function ProfileNavAvatar() {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/explore")}`;

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Guest";

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || undefined;

  if (loading) {
    return (
      <div
        className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-default-200"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href={loginHref}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-success transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Dropdown
      placement="bottom-end"
      classNames={{
        content: MENU_GLASS_CLASS,
      }}
    >
      <DropdownTrigger>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success"
          aria-label="Profile menu"
        >
          <Avatar
            size="sm"
            src={avatarUrl}
            name={displayName}
            getInitials={() => avatarInitials(displayName)}
            classNames={{
              base: "h-9 w-9 bg-success/20 text-success",
              name: "text-sm font-semibold",
            }}
          />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Profile actions"
        classNames={{
          base: "bg-transparent p-0",
          list: "gap-0.5 bg-transparent",
        }}
        itemClasses={{
          base: cn(NAV_MENU_ITEM_CLASS, "text-foreground/70"),
        }}
      >
        <DropdownSection showDivider>
          <DropdownItem
            key="identity"
            isReadOnly
            className="cursor-default opacity-100"
            classNames={{ base: "pointer-events-none data-[hover=true]:bg-transparent" }}
          >
            <div className="flex flex-col gap-0.5 py-0.5">
              <span className="text-sm font-medium text-foreground">{displayName}</span>
              <span className="text-xs text-default-500">{user.email}</span>
            </div>
          </DropdownItem>
        </DropdownSection>
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
          key="library"
          href="/library"
          as={Link}
          startContent={
            <AssetMaskIcon src="/ui-icons/bookmark-outline.svg" size={16} />
          }
        >
          Library
        </DropdownItem>
        <DropdownItem
          key="activity"
          href="/activity"
          as={Link}
          startContent={
            <HugeiconsIcon icon={ChartLineData01Icon} size={16} className="shrink-0" />
          }
        >
          Activity
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
        <DropdownItem
          key="signout"
          classNames={{ base: NAV_MENU_ITEM_DANGER_CLASS }}
          startContent={
            <HugeiconsIcon icon={Logout01Icon} size={16} className="shrink-0" />
          }
          onPress={() => void signOut()}
        >
          Sign out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
