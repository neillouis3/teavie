"use client";

import React from "react";
import { cn } from "@/lib/utils";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import type { PageShellBackdrop } from "@/lib/pageBackdrop";
import {
  PAGE_CONTENT_AFTER_HEADER,
  PAGE_CONTENT_OUTER,
  PAGE_DESCRIPTION,
  PAGE_SHELL_MIN,
  PAGE_TITLE,
  USER_PAGE_HEADER,
} from "@/lib/pageLayout";

type UserPageShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Main column width (default: form/card pages). */
  contentMaxWidth?: "2xl" | "6xl";
  /** Wrap main content (default: centered column with top spacing). */
  contentClassName?: string;
  headerClassName?: string;
  /** Static blurred backdrop (default: library shell). */
  backdrop?: PageShellBackdrop;
  /** TMDB / hero art for a frosted dynamic backdrop. */
  backdropImageUrl?: string | null;
  /** Backdrop while hero art is loading or unavailable. */
  backdropEmptyFallback?: "shell" | "dark";
};

/** Library-style shell: blurred backdrop + centered page header. */
export default function UserPageShell({
  title,
  description,
  children,
  contentMaxWidth = "2xl",
  contentClassName,
  headerClassName,
  backdrop = "shell",
  backdropImageUrl,
  backdropEmptyFallback = "shell",
}: UserPageShellProps) {
  return (
    <div className={PAGE_SHELL_MIN}>
      <PageBlurredBackdrop
        variant={backdrop}
        imageUrl={backdropImageUrl}
        emptyFallback={backdropEmptyFallback}
      />

      <div className={PAGE_CONTENT_OUTER}>
        <header className={cn(USER_PAGE_HEADER, headerClassName)}>
          <h1 className={PAGE_TITLE}>{title}</h1>
          {description ? (
            <p className={PAGE_DESCRIPTION}>{description}</p>
          ) : null}
        </header>

        <div
          className={cn(
            PAGE_CONTENT_AFTER_HEADER,
            contentMaxWidth === "6xl" ? "max-w-6xl" : "max-w-2xl",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
