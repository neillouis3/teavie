import React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

type DetailSectionHeaderProps = {
  children: React.ReactNode;
  href?: string;
};

/** Compact heading shared by detail-modal sections. */
export default function DetailSectionHeader({
  children,
  href,
}: DetailSectionHeaderProps) {
  return (
    <h2 className="flex min-h-7 min-w-0 items-center text-lg font-normal leading-none tracking-tight text-foreground">
      {href ? (
        <Link
          href={href}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md py-1 transition-colors hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50"
        >
          <span className="truncate">{children}</span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={17}
            strokeWidth={2}
            className="shrink-0"
            aria-hidden
          />
        </Link>
      ) : (
        <span className="truncate">{children}</span>
      )}
    </h2>
  );
}
