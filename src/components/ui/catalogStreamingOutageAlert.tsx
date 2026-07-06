"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import {
  CATALOG_STREAMING_OUTAGE_ACTIVE,
  pathShowsCatalogStreamingOutage,
} from "@/lib/streamingOutage";

const STORAGE_KEY = "teavie:streaming-outage-notice-seen:v1";

export default function CatalogStreamingOutageModal() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const shouldOffer =
    CATALOG_STREAMING_OUTAGE_ACTIVE &&
    pathShowsCatalogStreamingOutage(pathname);

  useEffect(() => {
    if (!shouldOffer) {
      setOpen(false);
      return;
    }

    try {
      const seen = localStorage.getItem(STORAGE_KEY) === "1";
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [shouldOffer, pathname]);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors and close anyway.
    }
    setOpen(false);
  };

  if (!shouldOffer || !open) return null;

  return (
    <Modal
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
      size="md"
      backdrop="blur"
      placement="center"
      isDismissable
      isKeyboardDismissDisabled={false}
      hideCloseButton
      classNames={{
        base: "border border-warning-200/60 dark:border-warning-500/25",
      }}
    >
      <ModalContent>
        <ModalHeader className="pb-1 text-warning-800 dark:text-warning-200">
          Streaming service notice
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm leading-relaxed text-foreground/85">
            Movie and TV show playback is temporarily unavailable because global
            streaming servers are currently down.
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            Anime continues to play normally. We are working to find the
            problem and apologize for the inconvenience.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="warning" variant="flat" onPress={handleClose}>
            Understood
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
