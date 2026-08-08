"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalContent } from "@heroui/react";

export default function ResponsiveDetailsOverlay({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const close = onClose ?? (() => router.back());

  return (
    <Modal
      key={label}
      isOpen
      onClose={close}
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
      size="5xl"
      aria-label={label}
      classNames={{
        base:
          "isolate overflow-hidden border border-white/15 bg-background/65 shadow-[0_24px_100px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl dark:!bg-[#101214]/90 dark:[--background:#101214] dark:[--foreground:#f4f4f5]",
        backdrop: "bg-black/45 backdrop-blur-md",
        closeButton:
          "z-50 bg-black/45 text-white backdrop-blur-md hover:bg-black/65",
      }}
    >
      <ModalContent>
        {() => (
          <div className="h-full w-full overflow-y-auto">
            {children}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
