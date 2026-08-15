"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Share08Icon } from "@hugeicons/core-free-icons";
import { DETAIL_ICON_ACTION_CLASS } from "@/lib/detailActions";

type DetailShareButtonProps = {
  title: string;
  href: string;
};

export default function DetailShareButton({
  title,
  href,
}: DetailShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = new URL(href, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The native share sheet or clipboard may be unavailable.
    }
  };

  const label = copied ? "Link copied" : `Share ${title}`;

  return (
    <Button
      isIconOnly
      size="sm"
      radius="lg"
      className={DETAIL_ICON_ACTION_CLASS}
      aria-label={label}
      title={label}
      onPress={() => void share()}
    >
      <HugeiconsIcon icon={Share08Icon} size={18} strokeWidth={2} />
    </Button>
  );
}
