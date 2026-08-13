"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavSearchBar from "@/components/ui/navSearchBar";
import ProfileNavAvatar from "@/components/ui/profileNavAvatar";
import ThemeNavButton from "@/components/ui/themeNavButton";
import AssetMaskIcon from "@/components/ui/assetMaskIcon";
import { APP_NAV_ITEMS } from "@/components/ui/navItems";
import { TEAVIE_LOGO } from "@/lib/brandAssets";
import { EXPLORE_HOME, LIBRARY_HOME } from "@/lib/routes";

function SearchFallback() {
  return <div className="h-9 w-44 animate-pulse rounded-full bg-white/10" aria-hidden />;
}

function activeNavKey(pathname: string) {
  if (pathname.startsWith("/movies")) return "movies";
  if (pathname.startsWith("/shows")) return "shows";
  if (pathname.startsWith("/anime")) return "anime";
  if (pathname.startsWith("/kdrama")) return "kdrama";
  if (pathname.startsWith("/sports")) return "sports";
  if (pathname.startsWith(LIBRARY_HOME)) return "library";
  if (pathname.startsWith(EXPLORE_HOME)) return "explore";
  return null;
}

const NAV_LABELS: Record<string, string> = {
  explore: "Home",
  shows: "Shows",
  sports: "Live",
  kdrama: "K-Drama",
};

/** Floating desktop navigation that stays readable over heroes and regular pages. */
export default function DesktopTopNav() {
  const pathname = usePathname();
  const selectedKey = activeNavKey(pathname);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden px-4 pt-3 lg:flex lg:justify-center">
      <div className="pointer-events-auto flex h-14 w-full max-w-[80rem] items-center gap-1 rounded-[1.15rem] border border-white/10 bg-background/58 px-2 text-foreground shadow-[0_14px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/44 dark:bg-black/45">
        <Link
          href={EXPLORE_HOME}
          aria-label="Teavie home"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
        >
          <Image
            src={TEAVIE_LOGO.icon}
            alt=""
            width={28}
            height={28}
            priority
            className="mx-auto h-7 w-7 object-contain"
          />
        </Link>

        <div className="mx-0.5 h-6 w-px shrink-0 bg-foreground/10" />

        <nav className="flex min-w-0 flex-1 items-center gap-0.5" aria-label="Primary navigation">
          {APP_NAV_ITEMS.map((item) => {
            const active = selectedKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-foreground/10 text-foreground shadow-sm dark:bg-white/12"
                    : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"
                }`}
              >
                <AssetMaskIcon
                  src={active && item.icon.activeSrc ? item.icon.activeSrc : item.icon.src}
                  size={16}
                />
                <span>{NAV_LABELS[item.key] ?? item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mx-0.5 h-6 w-px shrink-0 bg-foreground/10" />

        <Suspense fallback={<SearchFallback />}>
          <NavSearchBar className="w-44 xl:w-52" size="sm" />
        </Suspense>

        <div className="flex shrink-0 items-center gap-0.5">
          <ThemeNavButton />
          <ProfileNavAvatar />
        </div>
      </div>
    </header>
  );
}
