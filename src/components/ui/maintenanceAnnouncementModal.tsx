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

const STORAGE_KEY = "teavie:maintenance-announcement-seen:v1";

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
        <ModalHeader className="pb-1">Maintenance announcement</ModalHeader>
        <ModalBody>
          <p className="text-sm leading-relaxed text-foreground/85">
          We are currently doing maintenance and moving the site to a new place.
          You may notice bugs while this is in progress.
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            Images and posters may fail to load, but you should still be able
            to watch movies and shows.
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
