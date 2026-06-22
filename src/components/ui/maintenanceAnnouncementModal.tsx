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

const STORAGE_KEY = "teavie:maintenance-announcement-seen:v2";

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
        <ModalHeader className="pb-1">A quick heads-up</ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm leading-relaxed text-foreground/85">
            We&apos;re refreshing the movie catalog and updating genres, browse,
            and search across Teavie. The site is being actively worked on right
            now.
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            You might notice a few bugs — missing posters, odd genre labels, or
            titles shuffling around while data syncs. That&apos;s expected for
            the moment.
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">
            Feel free to keep using the site. Movies and shows should still play
            as usual. Thanks for your patience while we improve things.
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
