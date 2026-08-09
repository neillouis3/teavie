"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@heroui/react";
import AssetMaskIcon from "@/components/ui/assetMaskIcon";

type NavSearchBarProps = {
  /** Full width on mobile popover; constrained on desktop nav */
  className?: string;
  size?: "sm" | "md";
  onSubmitted?: () => void;
  /** 0 = clear nav over hero, 1 = full glass */
  navBlend?: number;
};

export default function NavSearchBar({
  className = "",
  size = "sm",
  onSubmitted,
  navBlend,
}: NavSearchBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    if (pathname === "/search") setValue(q);
  }, [pathname, searchParams]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    onSubmitted?.();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const overHero = navBlend != null && navBlend < 0.55;
  const glassSearch = navBlend == null || navBlend >= 0.85;

  return (
    <form onSubmit={submit} className={className}>
      <Input
        size={size}
        variant="flat"
        placeholder="Search movies, shows, anime…"
        value={value}
        onValueChange={setValue}
        aria-label="Search"
        startContent={
          <AssetMaskIcon
            src="/ui-icons/search.svg"
            size={size === "md" ? 18 : 16}
            className={`shrink-0 ${overHero ? "text-white/70" : "text-default-400"}`}
          />
        }
        classNames={{
          input: `text-sm ${overHero ? "text-white placeholder:text-white/55" : ""}`,
          inputWrapper: glassSearch
            ? "h-10 bg-default-100/50 shadow-none backdrop-blur-sm hover:bg-default-100/65 data-[focus=true]:bg-default-100/55 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
            : "h-10 border border-white/15 bg-black/30 shadow-none backdrop-blur-sm hover:bg-black/40 data-[focus=true]:bg-black/40",
        }}
      />
    </form>
  );
}
