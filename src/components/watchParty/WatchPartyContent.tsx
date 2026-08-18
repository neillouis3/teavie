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
import { TEXT_CAPTION_MUTED, TEXT_UI, TEXT_UI_MUTED } from "@/lib/typography";

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
      <div className="rounded-xl bg-warning/10 px-3 py-2.5">
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
      <div className="rounded-xl bg-white/5 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">Waiting to sync in</p>
        <p className="mt-1 text-xs leading-relaxed text-default-500">
          The host is pausing at their current spot. Your player will load there when
          they resume the party.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
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
    <details className="group rounded-xl bg-white/5 px-3 py-2">
      <summary className={`cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden ${TEXT_CAPTION_MUTED} font-medium`}>
        <span className="group-open:hidden">Party options</span>
        <span className="hidden group-open:inline">Hide options</span>
      </summary>

      <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
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
      </div>
    </details>
  );
}

const INPUT_SHELL =
  "border border-white/10 bg-white/5 shadow-none data-[hover=true]:bg-white/8 group-data-[focus=true]:bg-white/8";

type LobbyMode = "start" | "join";

function LobbyModeToggle({
  mode,
  onChange,
}: {
  mode: LobbyMode;
  onChange: (mode: LobbyMode) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/5 p-1">
      {(["start", "join"] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${TEXT_UI} ${
            mode === key
              ? "bg-white/10 text-foreground"
              : "text-default-500 hover:text-foreground"
          }`}
        >
          {key === "start" ? "Start" : "Join"}
        </button>
      ))}
    </div>
  );
}

export function WatchPartyContent({
  room,
  isHost,
  loading,
  error,
  nickname: defaultNick,
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
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("start");
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
      <div className="flex flex-col gap-4">
        {error ? (
          <p className={`rounded-lg bg-danger/10 px-3 py-2 text-danger ${TEXT_UI}`}>{error}</p>
        ) : null}

        {displayTitle ? (
          <p className={`truncate text-center ${TEXT_UI_MUTED}`}>
            <span className="text-foreground">{displayTitle}</span>
          </p>
        ) : null}

        <LobbyModeToggle mode={lobbyMode} onChange={setLobbyMode} />

        <Input
          placeholder="Your name"
          size="sm"
          value={nick}
          onValueChange={setNick}
          classNames={{
            inputWrapper: INPUT_SHELL,
            input: "text-sm",
          }}
        />

        {lobbyMode === "join" ? (
          <Input
            placeholder="Party code"
            size="sm"
            value={joinCode}
            onValueChange={setJoinCode}
            classNames={{
              input: "uppercase tracking-[0.18em] font-mono text-sm",
              inputWrapper: INPUT_SHELL,
            }}
          />
        ) : null}

        <Button
          color="success"
          className="font-medium"
          isLoading={loading}
          onPress={() =>
            lobbyMode === "start"
              ? void onCreate(nick)
              : onJoin(joinCode.trim().toUpperCase(), nick)
          }
        >
          {lobbyMode === "start" ? "Start party" : "Join party"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className={`rounded-lg bg-danger/10 px-3 py-2 text-danger ${TEXT_UI}`}>{error}</p>
      ) : null}

      <TeaPartySyncBanner
        room={room}
        isHost={isHost}
        guestJoinSyncRole={guestJoinSyncRole}
        onReleaseSync={onReleaseSync}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {displayTitle ? (
            <p className={`truncate font-medium text-foreground ${TEXT_UI}`}>{displayTitle}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyText(room.roomId, "code")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.16em] text-success transition-colors hover:bg-success/20"
            >
              {room.roomId}
              <HugeiconsIcon icon={Copy01Icon} size={13} />
            </button>
            <span className={TEXT_CAPTION_MUTED}>
              {isHost ? "Hosting" : "Guest"}
            </span>
          </div>
          {copied === "code" ? (
            <p className="text-xs text-success">Code copied</p>
          ) : copied === "link" ? (
            <p className="text-xs text-success">Link copied</p>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="light"
          isIconOnly
          aria-label="Leave party"
          onPress={onLeave}
          className="text-default-500"
        >
          <HugeiconsIcon icon={Logout03Icon} size={18} />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="flat"
          className="flex-1 bg-white/5"
          startContent={<HugeiconsIcon icon={LinkSquare01Icon} size={15} />}
          onPress={() => void copyText(partyUrl, "link")}
        >
          Copy invite link
        </Button>
      </div>

      {isHost ? (
        <TeaPartySettingsPanel
          settings={room.settings}
          onUpdateSettings={onUpdateSettings}
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {room.members.map((m) => (
          <span
            key={m.id}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
              m.isHost
                ? "bg-success/15 text-success"
                : "bg-white/5 text-default-600 dark:text-default-400"
            }`}
          >
            <span className="font-medium">{m.nickname}</span>
            {m.isHost ? <span className="opacity-70">host</span> : null}
          </span>
        ))}
      </div>

      <div className="flex max-h-40 min-h-[7rem] flex-col overflow-hidden rounded-xl bg-white/5">
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {room.messages.length === 0 ? (
            <p className="py-4 text-center text-xs text-default-400">Say hi to the party</p>
          ) : (
            room.messages.map((m) => {
              const isSelf = m.nickname === nick;
              return (
                <div
                  key={m.id}
                  className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${
                      isSelf
                        ? "rounded-br-md bg-success/15 text-foreground"
                        : "rounded-bl-md bg-white/10 text-foreground"
                    }`}
                  >
                    {!isSelf ? (
                      <p className="mb-0.5 text-xs font-medium text-default-500">
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
          className="flex gap-2 border-t border-white/10 p-2"
        >
          <Input
            size="sm"
            placeholder="Message…"
            value={chatDraft}
            onValueChange={setChatDraft}
            className="flex-1"
            classNames={{
              inputWrapper: "border-0 bg-transparent shadow-none",
              input: "text-sm",
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
