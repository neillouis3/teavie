import React from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";

export const PAGE_CARD =
  "rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md";

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
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          {icon ? (
            <HugeiconsIcon icon={icon} size={18} className="shrink-0 text-white/50" aria-hidden />
          ) : null}
          <span>{title}</span>
        </h2>
        {action ?? null}
      </div>
      <div className="mt-4 space-y-5">{children}</div>
      {footer ? <p className="mt-4 text-xs leading-relaxed text-white/45">{footer}</p> : null}
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
      <p className="flex items-center gap-2 text-sm text-white/80">
        {icon ? (
          <HugeiconsIcon icon={icon} size={16} className="shrink-0 text-white/50" aria-hidden />
        ) : null}
        <span>{label}</span>
      </p>
      <div className={stackOnMobile ? "sm:flex sm:justify-end" : "w-full"}>{children}</div>
    </div>
  );
}
