import React from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PAGE_CARD_FOOTER,
  PAGE_CARD_LABEL,
  PAGE_CARD_TITLE,
} from "@/lib/pageLayout";

export const PAGE_CARD =
  "rounded-xl border border-default-200/60 bg-background p-5 shadow-sm dark:border-white/10 dark:bg-black/40 dark:shadow-none dark:backdrop-blur-md";

type PageCardProps = {
  title: string;
  icon?: IconSvgElement;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: string;
};

export function PageCard({ title, icon, action, children, footer }: PageCardProps) {
  return (
    <section className={PAGE_CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={PAGE_CARD_TITLE}>
          {icon ? (
            <HugeiconsIcon
              icon={icon}
              size={18}
              className="shrink-0 text-default-400"
              aria-hidden
            />
          ) : null}
          <span>{title}</span>
        </h2>
        {action ?? null}
      </div>
      <div className="mt-4 space-y-5">{children}</div>
      {footer ? <p className={`mt-4 ${PAGE_CARD_FOOTER}`}>{footer}</p> : null}
    </section>
  );
}

type PageCardRowProps = {
  label?: string;
  icon?: IconSvgElement;
  children: React.ReactNode;
  stackOnMobile?: boolean;
};

export function PageCardRow({
  label,
  icon,
  children,
  stackOnMobile = true,
}: PageCardRowProps) {
  if (!label) {
    return <div>{children}</div>;
  }

  return (
    <div
      className={
        stackOnMobile
          ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          : "flex flex-col gap-3"
      }
    >
      <p className={PAGE_CARD_LABEL}>
        {icon ? (
          <HugeiconsIcon
            icon={icon}
            size={16}
            className="shrink-0 text-default-400"
            aria-hidden
          />
        ) : null}
        <span>{label}</span>
      </p>
      <div className={stackOnMobile ? "sm:flex sm:justify-end" : "w-full"}>
        {children}
      </div>
    </div>
  );
}
