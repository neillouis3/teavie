"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";

type ThemeNavButtonProps = {
  overHero?: boolean;
};

export default function ThemeNavButton({ overHero = false }: ThemeNavButtonProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      isIconOnly
      variant="light"
      radius="md"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`h-9 w-9 min-w-9 ${overHero ? "text-white" : "text-foreground"}`}
      isDisabled={!mounted}
      onPress={toggleTheme}
    >
      {mounted ? (
        <HugeiconsIcon
          icon={isDark ? Sun03Icon : Moon02Icon}
          size={20}
          className="shrink-0"
        />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-default-200" aria-hidden />
      )}
    </Button>
  );
}
