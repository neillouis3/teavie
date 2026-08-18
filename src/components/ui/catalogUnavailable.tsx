"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ShieldBanIcon } from "@hugeicons/core-free-icons";

export type CatalogUnavailableReason =
  | "content_policy"
  | "not_found"
  | "unauthorized";

const UNAVAILABLE_COPY: Record<
  CatalogUnavailableReason,
  { heading: string; message: string }
> = {
  content_policy: {
    heading: "This title isn't available",
    message:
      "This content doesn't meet our community guidelines. We work to keep the platform safe and enjoyable for everyone.",
  },
  not_found: {
    heading: "This title isn't available",
    message: "This show isn't in our catalog right now.",
  },
  unauthorized: {
    heading: "Preview unavailable",
    message:
      "Invalid admin key. Check TEAVIE_ADMIN_KEY and the ?key= parameter.",
  },
};

export type CatalogUnavailableProps = {
  reason?: CatalogUnavailableReason | null;
  variant?: "page" | "modal";
  backdropUrl?: string | null;
};

function UnavailableMessage({
  reason,
  compact,
}: {
  reason: CatalogUnavailableReason;
  compact?: boolean;
}) {
  const copy = UNAVAILABLE_COPY[reason] ?? UNAVAILABLE_COPY.not_found;
  const showAppeal = reason === "content_policy" && !compact;
  const icon =
    reason === "content_policy" ? (
      <HugeiconsIcon
        icon={Alert02Icon}
        size={compact ? 40 : 28}
        className={compact ? "text-danger" : "text-default-500"}
        strokeWidth={1.5}
      />
    ) : (
      <HugeiconsIcon
        icon={ShieldBanIcon}
        size={compact ? 40 : 28}
        className="text-default-500"
        strokeWidth={1.5}
      />
    );

  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? "max-w-sm px-6" : "max-w-md"
      }`}
    >
      <div
        className={`mb-6 flex items-center justify-center rounded-full ${
          compact
            ? "h-16 w-16 bg-danger/10"
            : "h-14 w-14 bg-default-100/40 dark:bg-default-100/10"
        }`}
      >
        {icon}
      </div>

      <h1
        className={`font-semibold text-foreground ${
          compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
        }`}
      >
        {copy.heading}
      </h1>

      <p
        className={`mt-3 leading-relaxed text-default-500 ${
          compact ? "text-sm" : "text-sm sm:text-base"
        }`}
      >
        {copy.message}
      </p>

      {showAppeal ? (
        <p className="mt-4 text-xs text-default-500">
          If you think this should be okay to watch, contact me{" "}
          <a
            href="https://x.com/neillouis3dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-default-400 underline underline-offset-2 hover:text-default-300"
          >
            @neillouis3dev
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

export default function CatalogUnavailable({
  reason = "not_found",
  variant = "page",
  backdropUrl = null,
}: CatalogUnavailableProps) {
  const router = useRouter();
  const key = reason ?? "not_found";

  if (variant === "modal") {
    return (
      <div
        className="relative isolate flex min-h-[min(70vh,560px)] w-full items-center justify-center overflow-hidden"
        role="alert"
      >
        {backdropUrl ? (
          <>
            <img
              src={backdropUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-black/70"
              aria-hidden
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-background/95 dark:bg-[#101214]/95" />
        )}
        <div className="relative z-10 py-12">
          <UnavailableMessage reason={key} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center bg-background px-6 py-12 text-center lg:min-h-[100dvh]">
      <UnavailableMessage reason={key} />
      <Button
        variant="bordered"
        className="mt-8 border-default-300 text-foreground dark:border-default-500/60"
        onPress={() => router.push("/explore")}
      >
        Continue exploring the site
      </Button>
    </div>
  );
}
