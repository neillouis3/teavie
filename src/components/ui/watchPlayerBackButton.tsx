"use client";

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type WatchPlayerBackButtonProps = {
  className?: string;
  onBack?: () => void;
};

export default function WatchPlayerBackButton({
  className = "",
  onBack,
}: WatchPlayerBackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={onBack ?? (() => router.back())}
      aria-label="Go back"
      className={cn(
        "pointer-events-auto absolute left-4 top-4 z-30 flex h-11 w-11 cursor-pointer items-center justify-center text-white sm:left-5 sm:top-5",
        className
      )}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} size={22} strokeWidth={2} />
    </button>
  );
}
