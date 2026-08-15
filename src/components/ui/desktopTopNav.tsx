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
import { NAV_DESKTOP_INNER_CLASS, NAV_DESKTOP_SHELL_CLASS } from "@/lib/navLayout";

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
    <header className={NAV_DESKTOP_SHELL_CLASS}>
      <div className={NAV_DESKTOP_INNER_CLASS}>
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

        <nav className="flex min-w-0 flex-1 items-center gap-1" aria-label="Primary navigation">
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

        <div className="flex shrink-0 items-center gap-2">
          <ThemeNavButton />
          <ProfileNavAvatar />
        </div>
      </div>
    </header>
  );
}
