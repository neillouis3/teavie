"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Input, Radio, RadioGroup, Select, SelectItem } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  LinkSquare01Icon,
  Logout03Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import type { WatchPartyRoom } from "@/hooks/useWatchParty";
import type { TeaPartyGuestSyncRole, TeaPartyGuestJoinMode, TeaPartySettings } from "@/lib/teaPartySync";

export type WatchPartyContentProps = {
  room: WatchPartyRoom | null;
  isHost: boolean;
  loading: boolean;
  error: string;
  nickname: string;
  mediaType: "tv" | "movie";
  title?: string;
  onCreate: (nickname: string) => void | Promise<string | null>;
  onJoin: (roomId: string, nickname: string) => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
  onUpdateSettings: (settings: Partial<TeaPartySettings>) => void | Promise<void>;
  onReleaseSync: () => void | Promise<void>;
  guestJoinSyncRole?: TeaPartyGuestSyncRole;
};

function memberInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function useSyncHoldCountdown(
  active: boolean,
  startedAt: string | null,
  totalSeconds: number
) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (!active || !startedAt) {
      setRemaining(totalSeconds);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - Date.parse(startedAt)) / 1000);
      setRemaining(Math.max(0, totalSeconds - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [active, startedAt, totalSeconds]);

  return remaining;
}

function TeaPartySyncBanner({
  room,
  isHost,
  guestJoinSyncRole,
  onReleaseSync,
}: {
  room: WatchPartyRoom;
  isHost: boolean;
  guestJoinSyncRole?: TeaPartyGuestSyncRole;
  onReleaseSync: () => void | Promise<void>;
}) {
  const remaining = useSyncHoldCountdown(
    room.syncHold?.active ?? false,
    room.syncHold?.startedAt ?? null,
    room.settings.autoResumeSeconds
  );

  if (!room.syncHold?.active) return null;

  const guestName = room.syncHold.triggerNickname ?? "Someone";
  const autoMode = room.settings.onGuestJoin === "auto_resume";

  if (isHost) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {guestName} joined — pause your player
        </p>
        <p className="mt-1 text-xs leading-relaxed text-default-600 dark:text-default-400">
          {autoMode
            ? `Only you need to pause. Everyone resyncs to your position in ${remaining}s.`
            : "Pause your player, then resume the party when you are ready to sync everyone."}
        </p>
        {!autoMode || remaining <= 2 ? (
          <Button
            size="sm"
            color="success"
            className="mt-3"
            onPress={() => void onReleaseSync()}
          >
            Resume party
          </Button>
        ) : null}
      </div>
    );
  }

  if (guestJoinSyncRole === "joiner") {
    return (
      <div className="rounded-xl border border-default-200/80 bg-default-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-medium text-foreground">Waiting to sync in</p>
        <p className="mt-1 text-xs leading-relaxed text-default-500">
          The host is pausing at their current spot. Your player will load there when
          they resume the party.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-default-200/80 bg-default-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-sm font-medium text-foreground">Resyncing the party</p>
      <p className="mt-1 text-xs leading-relaxed text-default-500">
        {guestName} joined. Your player will refresh to the host&apos;s position when
        they resume — you can keep watching for now.
      </p>
    </div>
  );
}

function TeaPartySettingsPanel({
  settings,
  onUpdateSettings,
}: {
  settings: TeaPartySettings;
  onUpdateSettings: (patch: Partial<TeaPartySettings>) => void | Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-default-200/80 bg-default-50/50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-500">
        Party options
      </p>

      <RadioGroup
        label="When someone joins"
        size="sm"
        value={settings.onGuestJoin}
        onValueChange={(value) =>
          void onUpdateSettings({
            onGuestJoin: value as TeaPartyGuestJoinMode,
          })
        }
        classNames={{ label: "text-xs text-default-500" }}
      >
        <Radio value="off" description="Guests sync in the background only.">
          No pause
        </Radio>
        <Radio
          value="auto_resume"
          description="You pause; everyone resyncs after a short countdown."
        >
          Pause & auto-resume
        </Radio>
        <Radio
          value="host_resume"
          description="You pause and tap Resume when ready to sync everyone."
        >
          Pause until I resume
        </Radio>
      </RadioGroup>

      {settings.onGuestJoin === "auto_resume" ? (
        <Select
          label="Auto-resume delay"
          size="sm"
          className="mt-3"
          selectedKeys={new Set([String(settings.autoResumeSeconds)])}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0];
            if (!key) return;
            void onUpdateSettings({ autoResumeSeconds: Number(key) });
          }}
        >
          <SelectItem key="3">3 seconds</SelectItem>
          <SelectItem key="5">5 seconds</SelectItem>
          <SelectItem key="10">10 seconds</SelectItem>
        </Select>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-default-400">
        Only the host pauses manually. On resume, all guests remount to the same
        position. Drift beyond ~35s is corrected automatically during playback.
      </p>
    </div>
  );
}

export function WatchPartyContent({
  room,
  isHost,
  loading,
  error,
  nickname: defaultNick,
  mediaType,
  title,
  onCreate,
  onJoin,
  onLeave,
  onSendChat,
  onUpdateSettings,
  onReleaseSync,
  guestJoinSyncRole = null,
}: WatchPartyContentProps) {
  const [nick, setNick] = useState(defaultNick);
  const [joinCode, setJoinCode] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const partyUrl =
    typeof window !== "undefined" && room
      ? `${window.location.origin}${window.location.pathname}?party=${room.roomId}`
      : "";

  const displayTitle = title?.trim() || room?.title?.trim() || "";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages.length]);

  const copyText = async (text: string, kind: "link" | "code") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const t = chatDraft.trim();
    if (!t) return;
    onSendChat(t);
    setChatDraft("");
  };

  if (!room) {
    return (
      <div className="flex flex-col gap-5 px-1 pb-4">
        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        {displayTitle ? (
          <div className="rounded-xl border border-default-200/80 bg-default-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-default-500">
              Watching
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">
              {displayTitle}
            </p>
          </div>
        ) : null}

        <Input
          label="Your name"
          size="sm"
          value={nick}
          onValueChange={setNick}
          classNames={{ inputWrapper: "bg-default-50/80 dark:bg-white/5" }}
        />

        <Button
          color="success"
          size="lg"
          className="font-medium"
          isLoading={loading}
          onPress={() => void onCreate(nick)}
        >
          Start a tea party
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-divider" />
          <span className="text-xs text-default-400">or join with a code</span>
          <div className="h-px flex-1 bg-divider" />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Party code"
            size="sm"
            value={joinCode}
            onValueChange={setJoinCode}
            className="min-w-[6rem] flex-1"
            classNames={{
              input: "uppercase tracking-[0.2em] font-mono",
              inputWrapper: "bg-default-50/80 dark:bg-white/5",
            }}
          />
          <Button
            size="lg"
            variant="bordered"
            isLoading={loading}
            onPress={() => onJoin(joinCode.trim().toUpperCase(), nick)}
          >
            Join
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-1 pb-4">
      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <TeaPartySyncBanner
        room={room}
        isHost={isHost}
        guestJoinSyncRole={guestJoinSyncRole}
        onReleaseSync={onReleaseSync}
      />

      {isHost ? (
        <TeaPartySettingsPanel
          settings={room.settings}
          onUpdateSettings={onUpdateSettings}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {displayTitle ? (
            <p className="line-clamp-1 text-sm font-medium text-foreground">
              {displayTitle}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyText(room.roomId, "code")}
              className="inline-flex items-center gap-2 rounded-lg bg-success/12 px-3 py-1.5 font-mono text-sm font-semibold tracking-[0.18em] text-success transition-colors hover:bg-success/18"
            >
              {room.roomId}
              <HugeiconsIcon icon={Copy01Icon} size={14} />
            </button>
            <span className="rounded-full bg-default-100 px-2.5 py-0.5 text-[11px] font-medium text-default-600 dark:bg-white/10 dark:text-default-400">
              {isHost ? "You are hosting" : "Following host"}
            </span>
          </div>
          {copied === "code" ? (
            <p className="text-xs text-success">Code copied</p>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="light"
          color="danger"
          startContent={<HugeiconsIcon icon={Logout03Icon} size={16} />}
          onPress={onLeave}
        >
          Leave
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="flat"
          startContent={<HugeiconsIcon icon={LinkSquare01Icon} size={16} />}
          onPress={() => void copyText(partyUrl, "link")}
        >
          {copied === "link" ? "Link copied" : "Copy invite link"}
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-default-500">
        {mediaType === "tv"
          ? "Episode changes sync immediately. Mid-join resync reloads everyone to the host."
          : "Playback syncs periodically. Mid-join resync reloads everyone to the host."}
      </p>

      <div className="flex flex-wrap gap-2">
        {room.members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 rounded-full border border-default-200/80 bg-default-50/80 py-1 pl-1 pr-3 dark:border-white/10 dark:bg-white/5"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${
                m.isHost
                  ? "bg-success text-success-foreground"
                  : "bg-default-200 text-foreground dark:bg-white/15"
              }`}
            >
              {memberInitials(m.nickname)}
            </span>
            <span className="text-xs font-medium text-foreground">
              {m.nickname}
              {m.isHost ? " · host" : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="flex max-h-44 min-h-[8rem] flex-col overflow-hidden rounded-xl border border-default-200/80 bg-default-50/50 dark:border-white/10 dark:bg-black/25">
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {room.messages.length === 0 ? (
            <p className="py-6 text-center text-xs text-default-400">
              No messages yet — say hi to the party
            </p>
          ) : (
            room.messages.map((m) => {
              const isSelf = m.nickname === nick;
              return (
                <div
                  key={m.id}
                  className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      isSelf
                        ? "rounded-br-md bg-success/15 text-foreground"
                        : "rounded-bl-md bg-default-100 text-foreground dark:bg-white/10"
                    }`}
                  >
                    {!isSelf ? (
                      <p className="mb-0.5 text-[10px] font-semibold text-default-500">
                        {m.nickname}
                      </p>
                    ) : null}
                    <p className="text-sm leading-snug">{m.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={submitChat}
          className="flex gap-2 border-t border-default-200/80 p-2 dark:border-white/10"
        >
          <Input
            size="sm"
            placeholder="Message the party…"
            value={chatDraft}
            onValueChange={setChatDraft}
            className="flex-1"
            classNames={{
              inputWrapper: "bg-background/80 dark:bg-white/5",
            }}
          />
          <Button
            isIconOnly
            size="sm"
            type="submit"
            color="success"
            variant="flat"
            aria-label="Send message"
          >
            <HugeiconsIcon icon={SentIcon} size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
}
