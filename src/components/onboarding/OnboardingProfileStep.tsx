"use client";

import React, { useRef } from "react";
import { useTheme } from "next-themes";
import { Avatar, Button, Input } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { authFieldDefaults } from "@/components/auth/authFieldStyles";
import { avatarInitials } from "@/lib/partyNickname";

type ThemeChoice = "light" | "dark";

type OnboardingProfileStepProps = {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  avatarUrl: string | null;
  onAvatarFile: (file: File) => void;
  avatarError?: string | null;
};

function ThemeOption({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: typeof Sun03Icon;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      isIconOnly
      radius="md"
      aria-label={label}
      variant={selected ? "solid" : "flat"}
      color={selected ? "success" : "default"}
      onPress={onSelect}
      className="h-10 w-10 min-w-10"
    >
      <HugeiconsIcon icon={icon} size={20} className="shrink-0" />
    </Button>
  );
}

export default function OnboardingProfileStep({
  displayName,
  onDisplayNameChange,
  avatarUrl,
  onAvatarFile,
  avatarError,
}: OnboardingProfileStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const activeTheme = ((theme ?? resolvedTheme ?? "dark") === "dark"
    ? "dark"
    : "light") as ThemeChoice;

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex w-full flex-col items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group flex flex-col items-center gap-2 outline-none"
        >
          <Avatar
            src={avatarUrl ?? undefined}
            name={displayName || "Guest"}
            getInitials={() => avatarInitials(displayName || "Guest")}
            classNames={{
              base: "h-20 w-20 bg-success/20 text-success",
              name: "text-xl",
            }}
          />
          <span className="text-sm text-foreground/60 transition-colors group-hover:text-foreground">
            Change photo
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAvatarFile(file);
            e.target.value = "";
          }}
        />
        {avatarError ? (
          <p className="text-center text-xs text-danger">{avatarError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <Input
          {...authFieldDefaults}
          label="Display name"
          placeholder="How should we call you?"
          value={displayName}
          onValueChange={onDisplayNameChange}
          maxLength={64}
          autoComplete="nickname"
        />

        <div className="space-y-2">
          <p className="text-sm text-foreground/70">Theme</p>
          <div className="flex gap-2">
            <ThemeOption
              icon={Sun03Icon}
              label="Light"
              selected={activeTheme === "light"}
              onSelect={() => setTheme("light")}
            />
            <ThemeOption
              icon={Moon02Icon}
              label="Dark"
              selected={activeTheme === "dark"}
              onSelect={() => setTheme("dark")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
