"use client";

import React from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
} from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleTea01Icon } from "@hugeicons/core-free-icons";
import { MODAL_GLASS_CLASS } from "@/components/ui/navGlass";
import { TEXT_HEADING, TEXT_UI_MUTED } from "@/lib/typography";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";
import { WatchPartyContent } from "@/components/watchParty/WatchPartyContent";

export default function TeaPartyModal() {
  const { registration, isOpen, setTeaPartyOpen } = useWatchPartyNav();
  const canPlay = Boolean(registration?.canPlay);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={setTeaPartyOpen}
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
      size="md"
      classNames={{
        base: `${MODAL_GLASS_CLASS} border border-white/10 max-w-sm shadow-2xl`,
        body: "bg-transparent px-5 pb-5 pt-0",
        closeButton: "top-3 right-3 text-default-400 hover:text-foreground",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <div className="flex items-start gap-3 px-5 pb-4 pt-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <HugeiconsIcon icon={BubbleTea01Icon} size={20} />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 className={TEXT_HEADING}>Tea Party</h2>
                <p className={TEXT_UI_MUTED}>Watch in sync with friends</p>
              </div>
            </div>
            <ModalBody>
              {!canPlay || !registration ? (
                <p className={`pb-1 text-center leading-relaxed ${TEXT_UI_MUTED}`}>
                  Open a movie or show to watch, then start or join a party from here.
                </p>
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
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
