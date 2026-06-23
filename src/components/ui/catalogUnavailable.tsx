"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShieldBanIcon } from "@hugeicons/core-free-icons";

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
};

export default function CatalogUnavailable({
  reason = "not_found",
}: CatalogUnavailableProps) {
  const router = useRouter();
  const key = reason ?? "not_found";
  const copy = UNAVAILABLE_COPY[key] ?? UNAVAILABLE_COPY.not_found;
  const showAppeal = key === "content_policy";

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center bg-black px-6 py-12 text-center lg:min-h-[100dvh]">
      <div className="flex max-w-md flex-col items-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-default-100/10">
          <HugeiconsIcon
            icon={ShieldBanIcon}
            size={28}
            className="text-default-400"
            strokeWidth={1.5}
          />
        </div>

        <h1 className="text-xl font-semibold text-white sm:text-2xl">
          {copy.heading}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-default-400 sm:text-[15px]">
          {copy.message}
        </p>

        {showAppeal ? (
          <p className="mt-4 text-xs text-default-500">
            If you think this should be okay to watch, contact me{" "}
            <a
              href="https://x.com/neillouis3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-default-400 underline underline-offset-2 hover:text-default-300"
            >
              @neillouis3
            </a>
            .
          </p>
        ) : null}

        <Button
          variant="bordered"
          className="mt-8 border-default-500/60 text-default-200"
          onPress={() => router.push("/explore")}
        >
          Continue exploring the site
        </Button>
      </div>
    </div>
  );
}
