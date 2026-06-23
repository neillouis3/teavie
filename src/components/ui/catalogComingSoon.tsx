"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Image } from "@heroui/react";
import type { CatalogDetailLink } from "./catalogDetailColumns";
import { formatComingSoonDate } from "@/lib/formatRelease";

export type CatalogComingSoonProps = {
  title: string;
  posterUrl?: string | null;
  releaseDate?: string | null;
  links?: CatalogDetailLink[];
  /** Defaults to “This title isn't available yet.” */
  message?: string;
};

export default function CatalogComingSoon({
  title,
  posterUrl,
  releaseDate,
  links = [],
  message = "This title isn't available yet.",
}: CatalogComingSoonProps) {
  const router = useRouter();
  const dateLabel = formatComingSoonDate(releaseDate);
  const poster = String(posterUrl ?? "").trim();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black px-6 py-10 text-center">
      {poster ? (
        <Image
          src={poster}
          alt={title}
          classNames={{
            wrapper: "mb-5 shrink-0",
            img: "h-auto w-28 rounded-lg object-cover shadow-lg sm:w-36",
          }}
          radius="lg"
        />
      ) : null}

      <h2 className="max-w-md text-lg font-semibold text-white sm:text-xl">
        {title}
      </h2>

      <p className="mt-3 text-sm text-default-400">{message}</p>

      {dateLabel ? (
        <p className="mt-1 text-sm text-default-500">
          Come back on {dateLabel} to watch it.
        </p>
      ) : (
        <p className="mt-1 text-sm text-default-500">
          Check back once a release date is announced.
        </p>
      )}

      {links.length > 0 ? (
        <nav
          className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
          aria-label="External links"
        >
          {links.map((link) => (
            <a
              key={`${link.label}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-success underline underline-offset-2 hover:text-success-600"
            >
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}

      <Button
        variant="bordered"
        className="mt-6 border-default-500/60 text-default-200"
        onPress={() => router.push("/explore")}
      >
        Go Explore The Site
      </Button>
    </div>
  );
}
