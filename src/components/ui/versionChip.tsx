"use client";

import React from "react";
import { Chip } from "@heroui/react";
import { APP_VERSION } from "@/lib/appVersion";
import { cn } from "@/lib/utils";

type VersionChipProps = {
  className?: string;
};

export default function VersionChip({ className }: VersionChipProps) {
  return (
    <Chip
      size="sm"
      variant="flat"
      className={cn(
        "h-6 border border-default-200/50 bg-default-100/60 px-2 text-xs font-medium text-default-500",
        className
      )}
      aria-label={`Teavie version ${APP_VERSION}`}
    >
      v{APP_VERSION}
    </Chip>
  );
}
