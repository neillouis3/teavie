"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

type NavSearchBarProps = {
  /** Full width on mobile popover; constrained on desktop nav */
  className?: string;
  size?: "sm" | "md";
  onSubmitted?: () => void;
};

export default function NavSearchBar({
  className = "",
  size = "sm",
  onSubmitted,
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
          <HugeiconsIcon
            icon={Search01Icon}
            size={size === "md" ? 18 : 16}
            className="shrink-0 text-default-400"
          />
        }
        classNames={{
          input: "text-sm",
          inputWrapper:
            "h-10 bg-default-100 shadow-none hover:bg-default-200 data-[focus=true]:bg-default-100",
        }}
      />
    </form>
  );
}
