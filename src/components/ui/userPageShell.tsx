"use client";

import React from "react";
import { cn } from "@/lib/utils";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";

type UserPageShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Main column width (default: form/card pages). */
  contentMaxWidth?: "2xl" | "6xl";
  /** Wrap main content (default: centered column with top spacing). */
  contentClassName?: string;
  headerClassName?: string;
};

/** Library-style shell: blurred backdrop + centered page header. */
export default function UserPageShell({
  title,
  description,
  children,
  contentMaxWidth = "2xl",
  contentClassName,
  headerClassName,
}: UserPageShellProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden pb-24">
      <PageBlurredBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <header
          className={cn(
            "mx-auto flex w-full max-w-2xl flex-col items-center text-center",
            headerClassName
          )}
        >
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
              {description}
            </p>
          ) : null}
        </header>

        <div
          className={cn(
            "mx-auto mt-12 w-full",
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
