"use client";

import React, { useState } from "react";
import { Button, Input } from "@heroui/react";
import type { WatchPartyRoom } from "@/hooks/useWatchParty";

export type WatchPartyContentProps = {
  room: WatchPartyRoom | null;
  isHost: boolean;
  loading: boolean;
  error: string;
  nickname: string;
  mediaType: "tv" | "movie";
  onCreate: (nickname: string) => void | Promise<string | null>;
  onJoin: (roomId: string, nickname: string) => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
  compact?: boolean;
};

export function WatchPartyContent({
  room,
  isHost,
  loading,
  error,
  nickname: defaultNick,
  mediaType,
  onCreate,
  onJoin,
  onLeave,
  onSendChat,
  compact = false,
}: WatchPartyContentProps) {
  const [nick, setNick] = useState(defaultNick);
  const [joinCode, setJoinCode] = useState("");
  const [chatDraft, setChatDraft] = useState("");

  const partyUrl =
    typeof window !== "undefined" && room
      ? `${window.location.origin}${window.location.pathname}?party=${room.roomId}`
      : "";

  const copyLink = async () => {
    if (!partyUrl) return;
    try {
      await navigator.clipboard.writeText(partyUrl);
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

  return (
    <div className={compact ? "w-[min(100vw-2rem,22rem)] p-1" : "space-y-3"}>
      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}

      {!room ? (
        <div className="flex flex-col gap-3">
          <Input
            label="Your name"
            size="sm"
            value={nick}
            onValueChange={setNick}
          />
          <Button
            color="secondary"
            size="sm"
            isLoading={loading}
            onPress={() => void onCreate(nick)}
          >
            Start party
          </Button>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Party code"
              size="sm"
              value={joinCode}
              onValueChange={setJoinCode}
              className="min-w-[6rem] flex-1"
              classNames={{ input: "uppercase" }}
            />
            <Button
              size="sm"
              variant="bordered"
              isLoading={loading}
              onPress={() => onJoin(joinCode.trim().toUpperCase(), nick)}
            >
              Join
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-secondary/15 px-2 py-0.5 font-mono font-semibold tracking-widest text-secondary">
                {room.roomId}
              </span>
              {isHost ? (
                <span className="text-xs text-default-500">You are the host</span>
              ) : (
                <span className="text-xs text-default-500">Following host</span>
              )}
            </div>
            <Button size="sm" variant="light" onPress={onLeave}>
              Leave
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="flat" onPress={() => void copyLink()}>
              Copy link
            </Button>
          </div>

          {mediaType === "tv" ? (
            <p className="text-xs text-default-500">
              Episode and playback position sync for everyone. Play/pause inside
              the player cannot be synced.
            </p>
          ) : (
            <p className="text-xs text-default-500">
              Host playback position syncs periodically during the movie.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {room.members.map((m) => (
              <span
                key={m.id}
                className="rounded-full bg-default-100 px-2.5 py-0.5 text-xs text-foreground dark:bg-white/10"
              >
                {m.nickname}
                {m.isHost ? " ★" : ""}
              </span>
            ))}
          </div>

          <div className="max-h-36 overflow-y-auto rounded-lg bg-default-50 p-2 dark:bg-black/30">
            {room.messages.length === 0 ? (
              <p className="text-xs text-default-400">No messages yet</p>
            ) : (
              <ul className="space-y-1.5">
                {room.messages.map((m) => (
                  <li key={m.id} className="text-xs">
                    <span className="font-medium text-foreground">{m.nickname}: </span>
                    <span className="text-default-600 dark:text-default-400">{m.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={submitChat} className="flex gap-2">
            <Input
              size="sm"
              placeholder="Say something…"
              value={chatDraft}
              onValueChange={setChatDraft}
              className="flex-1"
            />
            <Button size="sm" type="submit" color="secondary" variant="flat">
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
