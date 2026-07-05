import React from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { exploreSectionIcon } from "@/lib/exploreSectionIcons";
import { cn } from "@/lib/utils";

export type ExploreSectionTitleVariant = "default" | "explore";

type ExploreSectionTitleProps = {
  children: React.ReactNode;
  className?: string;
  icon?: IconSvgElement;
  hideIcon?: boolean;
  variant?: ExploreSectionTitleVariant;
};

function titleFromChildren(children: React.ReactNode): string | null {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  return null;
}

/** Explore rail headings — plain text with optional section icon to the left. */
export default function ExploreSectionTitle({
  children,
  className = "",
  icon,
  hideIcon = false,
  variant = "default",
}: ExploreSectionTitleProps) {
  const label = titleFromChildren(children);
  const resolvedIcon = hideIcon ? undefined : icon ?? (label ? exploreSectionIcon(label) : undefined);
  const isExplore = variant === "explore";

  return (
    <h2
      className={`flex items-center gap-2.5 pl-2 text-xl font-normal leading-none tracking-tight text-foreground normal-case ${className}`.trim()}
    >
      {resolvedIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
          <HugeiconsIcon
            icon={resolvedIcon}
            size={isExplore ? 22 : 18}
            className={cn(isExplore ? "text-default-500" : "text-default-400")}
          />
        </span>
      ) : null}
      <span className="leading-none">{children}</span>
    </h2>
  );
}
