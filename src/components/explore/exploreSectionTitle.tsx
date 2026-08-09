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
  const resolvedIcon = hideIcon
    ? undefined
    : icon
      ? { kind: "huge" as const, icon }
      : label
        ? exploreSectionIcon(label)
        : undefined;
  const isExplore = variant === "explore";

  return (
    <h2
      className={`flex items-center gap-2.5 text-xl font-normal leading-none tracking-tight text-foreground normal-case ${className}`.trim()}
    >
      {resolvedIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
          {resolvedIcon.kind === "asset" ? (
            <span
              aria-hidden
              className={cn(
                isExplore ? "text-foreground" : "text-default-400",
                "inline-block shrink-0 bg-current",
                isExplore ? "size-[18px]" : "size-4"
              )}
              style={{
                WebkitMaskImage: `url(${resolvedIcon.src})`,
                maskImage: `url(${resolvedIcon.src})`,
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />
          ) : (
            <HugeiconsIcon
              icon={resolvedIcon.icon}
              size={isExplore ? 18 : 16}
              strokeWidth={2.2}
              className={cn(isExplore ? "text-foreground" : "text-default-400")}
            />
          )}
        </span>
      ) : null}
      <span className="leading-none">{children}</span>
    </h2>
  );
}
