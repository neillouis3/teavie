"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

const STORAGE_KEY = "teavie:maintenance-announcement-seen:v3";

export default function MaintenanceAnnouncementModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY) === "1";
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors and close anyway.
    }
    setOpen(false);
  };

  if (!open) return null;

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
        base: "border border-default-200/60 dark:border-default-100/20",
      }}
    >
      <ModalContent>
        <ModalHeader className="pb-1">What&apos;s new on Teavie</ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm leading-relaxed text-foreground/85">
            Thank you for your patience.
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            Teavie has a fresh new look and a bigger library — more anime,
            K-Drama, and easier ways to browse what you want to watch.
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            Take a look around and see what&apos;s new. We&apos;re glad
            you&apos;re here.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="success" onPress={handleClose}>
            Got it
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
