"use client";

import React from "react";
import { Avatar } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Home01Icon,
  Search01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { avatarInitials } from "@/lib/partyNickname";

type OnboardingConfirmStepProps = {
  displayName: string;
  avatarUrl: string | null;
};

const INFO_ITEMS: {
  icon: IconSvgElement;
  title: string;
  body: string;
}[] = [
  {
    icon: Settings01Icon,
    title: "Edit anytime",
    body: "Update your profile, categories, genres, and languages whenever you like.",
  },
  {
    icon: Search01Icon,
    title: "Nothing is locked",
    body: "You can still search and watch titles you did not pick during setup.",
  },
  {
    icon: Home01Icon,
    title: "Smarter Teavie",
    body: "Your choices only affect what we recommend to you, not what you can access.",
  },
];

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: IconSvgElement;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-default-200/80 bg-content1/40 px-3 py-3 dark:border-white/10">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
        <HugeiconsIcon icon={icon} size={18} className="shrink-0" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground/55">{body}</p>
      </div>
    </div>
  );
}

export default function OnboardingConfirmStep({
  displayName,
  avatarUrl,
}: OnboardingConfirmStepProps) {
  const name = displayName.trim() || "Guest";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 pt-1">
        <div className="relative">
          <Avatar
            src={avatarUrl ?? undefined}
            name={name}
            getInitials={() => avatarInitials(name)}
            classNames={{
              base: "h-16 w-16 bg-success/20 text-success",
              name: "text-lg",
            }}
          />
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-success text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {INFO_ITEMS.map((item) => (
          <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
        ))}
      </div>
    </div>
  );
}
