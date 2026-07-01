"use client";

import React from "react";
import { Checkbox } from "@heroui/react";
import { genreTileColor } from "@/components/genre/genreTileShared";

export type PreferenceChipOption = {
  id: string;
  label: string;
  description?: string;
};

type PreferenceChipGridProps = {
  options: PreferenceChipOption[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  columns?: 2 | 3;
  variant?: "plain" | "card" | "genre" | "list";
};

function GenreTileCheckbox({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-2 right-2 z-20 flex size-4 shrink-0 items-center justify-center rounded-md ${
        selected ? "bg-success text-white" : "bg-white/90"
      }`}
    >
      {selected ? (
        <svg
          viewBox="0 0 24 24"
          className="size-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

export default function PreferenceChipGrid({
  options,
  selected,
  onToggle,
  columns = 2,
  variant = "plain",
}: PreferenceChipGridProps) {
  if (variant === "card") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className="rounded-xl border border-default-200/80 bg-content1/40 px-3 py-3 text-left transition-colors hover:border-default-300 dark:border-white/10 dark:hover:border-white/20"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  isSelected={isSelected}
                  color="success"
                  radius="sm"
                  className="pointer-events-none shrink-0"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{option.label}</p>
                  {option.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground/55">
                      {option.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="flex flex-col gap-0.5">
        {options.map((option) => {
          const isSelected = selected.has(option.id);
          const showReason =
            isSelected &&
            option.id !== "en" &&
            Boolean(option.description);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className="flex items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-content2/50"
            >
              <Checkbox
                isSelected={isSelected}
                color="success"
                radius="sm"
                className="pointer-events-none shrink-0"
                aria-hidden
              />
              <span className="min-w-0 text-sm text-foreground">
                {option.label}
                {showReason ? (
                  <span className="text-foreground/55"> · {option.description}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "genre") {
    return (
      <div className="grid grid-cols-6 gap-2">
        {options.map((option, index) => {
          const isSelected = selected.has(option.id);
          const colorClass = genreTileColor(option.label, index);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className="relative flex aspect-square w-full overflow-hidden rounded-xl p-2 text-left transition-transform hover:scale-[1.02]"
            >
              <span
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${colorClass}`}
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 to-black/20"
                aria-hidden
              />
              <GenreTileCheckbox selected={isSelected} />
              <span className="relative z-10 mt-auto text-xs font-bold leading-tight text-white drop-shadow-sm">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const gridClass =
    columns === 3
      ? "grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3"
      : "flex flex-col gap-3";

  return (
    <div className={gridClass}>
      {options.map((option) => {
        const isSelected = selected.has(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            className={`text-left transition-colors ${
              isSelected
                ? "text-success"
                : "text-foreground/75 hover:text-foreground"
            }`}
          >
            <p className="text-sm">{option.label}</p>
            {option.description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-foreground/55">
                {option.description}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
