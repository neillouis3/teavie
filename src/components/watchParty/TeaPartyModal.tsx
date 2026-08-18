"use client";

import React from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleTea01Icon } from "@hugeicons/core-free-icons";
import { MODAL_GLASS_CLASS } from "@/components/ui/navGlass";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";
import { WatchPartyContent } from "@/components/watchParty/WatchPartyContent";

export default function TeaPartyModal() {
  const { registration, isOpen, setTeaPartyOpen } = useWatchPartyNav();
  const active = Boolean(registration?.room);
  const canPlay = Boolean(registration?.canPlay);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={setTeaPartyOpen}
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
      size="lg"
      classNames={{
        base: `${MODAL_GLASS_CLASS} border border-default-200/60 dark:border-white/10 max-w-lg shadow-xl`,
        body: "bg-transparent py-0",
        header: "bg-transparent pb-2",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                active
                  ? "bg-success/15 text-success"
                  : "bg-default-100 text-foreground dark:bg-white/10"
              }`}
            >
              <HugeiconsIcon icon={BubbleTea01Icon} size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight text-foreground">
                Tea Party
              </h2>
              <p className="text-xs font-normal text-default-500">
                Watch in sync with friends
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          {!canPlay || !registration ? (
            <div className="flex flex-col items-center gap-4 px-2 pb-4 pt-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-default-100 dark:bg-white/5">
                <HugeiconsIcon
                  icon={BubbleTea01Icon}
                  size={32}
                  className="text-default-400"
                />
              </div>
              <div className="max-w-sm space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  Open something to watch first
                </p>
                <p className="text-sm leading-relaxed text-default-500">
                  Go to a movie or show page, then start or join a tea party from
                  here.
                </p>
              </div>
            </div>
          ) : (
            <WatchPartyContent
              room={registration.room}
              isHost={registration.isHost}
              loading={registration.loading}
              error={registration.error}
              nickname={registration.nickname}
              mediaType={registration.mediaType}
              title={registration.title}
              onCreate={registration.onCreate}
              onJoin={registration.onJoin}
              onLeave={registration.onLeave}
              onSendChat={registration.onSendChat}
              onUpdateSettings={registration.onUpdateSettings}
              onReleaseSync={registration.onReleaseSync}
              guestJoinSyncRole={registration.guestJoinSyncRole}
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
