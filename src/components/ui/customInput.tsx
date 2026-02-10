"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@heroui/react";

const inputClassNames = {
  label: "text-black/50 dark:text-white/90",
  input: [
    "bg-transparent",
    "text-black/90 dark:text-white/90",
    "placeholder:text-default-700/50 dark:placeholder:text-white/60",
  ],
  innerWrapper: "bg-transparent",
  inputWrapper: [
    "bg-default-200/50",
    "dark:bg-sub",
    "backdrop-blur-xl",
    "backdrop-saturate-200",
    "hover:bg-default-200/70",
    "dark:hover:bg-default/70",
    "group-data-[focus=true]:bg-default-200/50",
    "dark:group-data-[focus=true]:bg-default/60",
    "!cursor-text",
    "w-96",
  ],
};

function CustomInputInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");

  const q = searchParams.get("q") ?? "";

  useEffect(() => {
    if (pathname === "/search") {
      setValue(q);
    }
  }, [pathname, q]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Input
        name="q"
        label="Search..."
        size="sm"
        variant="flat"
        value={value}
        onValueChange={setValue}
        placeholder="Movies, shows..."
        classNames={inputClassNames}
      />
    </form>
  );
}

function CustomInputFallback() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Input
        name="q"
        label="Search..."
        size="sm"
        variant="flat"
        value={value}
        onValueChange={setValue}
        placeholder="Movies, shows..."
        classNames={inputClassNames}
      />
    </form>
  );
}

export default function CustomInput() {
  return (
    <Suspense fallback={<CustomInputFallback />}>
      <CustomInputInner />
    </Suspense>
  );
}