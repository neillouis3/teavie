"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PARTY_HOST_BROADCAST_MS,
  PARTY_POLL_MS,
  planGuestSync,
  type GuestSyncPayload,
  type TeaPartySettings,
  type TeaPartySyncHold,
  normalizeTeaPartySettings,
  normalizeSyncHold,
} from "@/lib/teaPartySync";
import { PARTY_NICK_KEY } from "@/lib/partyNickname";

export type WatchPartyRoom = {
  roomId: string;
  catalogId: string;
  mediaType: "tv" | "movie";
  title: string;
  season: number;
  episode: number;
  playbackSeconds: number;
  playbackVersion: number;
  stateVersion: number;
  syncGeneration: number;
  settings: TeaPartySettings;
  syncHold: TeaPartySyncHold;
  stateUpdatedAt: string;
  members: Array<{ id: string; nickname: string; isHost: boolean }>;
  messages: Array<{
    id: string;
    memberId: string;
    nickname: string;
    text: string;
    at: string;
  }>;
};

const MEMBER_PREFIX = "teavie.party.member.";
const HOST_PREFIX = "teavie.party.hostToken.";

function storedNickname() {
  if (typeof window === "undefined") return "Guest";
  try {
    return localStorage.getItem(PARTY_NICK_KEY)?.trim() || "Guest";
  } catch {
    return "Guest";
  }
}

function saveNickname(n: string) {
  try {
    localStorage.setItem(PARTY_NICK_KEY, n.slice(0, 32));
    window.dispatchEvent(new CustomEvent("teavie-party-nickname-changed"));
  } catch {
    /* ignore */
  }
}

function storedMemberId(roomId: string) {
  try {
    return sessionStorage.getItem(`${MEMBER_PREFIX}${roomId}`) || "";
  } catch {
    return "";
  }
}

function saveMemberId(roomId: string, id: string) {
  try {
    sessionStorage.setItem(`${MEMBER_PREFIX}${roomId}`, id);
  } catch {
    /* ignore */
  }
}

function storedHostToken(roomId: string) {
  try {
    return sessionStorage.getItem(`${HOST_PREFIX}${roomId}`) || "";
  } catch {
    return "";
  }
}

function saveHostToken(roomId: string, token: string) {
  try {
    sessionStorage.setItem(`${HOST_PREFIX}${roomId}`, token);
  } catch {
    /* ignore */
  }
}

type UseWatchPartyOpts = {
  catalogId: string;
  mediaType: "tv" | "movie";
  title?: string;
  season?: number;
  episode?: number;
  roomIdFromUrl?: string | null;
  onGuestSync?: (payload: GuestSyncPayload) => void;
};

export function useWatchParty({
  catalogId,
  mediaType,
  title = "",
  season = 1,
  episode = 1,
  roomIdFromUrl,
  onGuestSync,
}: UseWatchPartyOpts) {
  const [room, setRoom] = useState<WatchPartyRoom | null>(null);
  const [memberId, setMemberId] = useState("");
  const [hostToken, setHostToken] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lastStateVersionRef = useRef(0);
  const lastPlaybackVersionRef = useRef(0);
  const lastSyncGenerationRef = useRef(0);
  const lastAppliedSecondsRef = useRef(-1);
  const hostPlaybackRef = useRef(0);
  const hostSeasonRef = useRef(season);
  const hostEpisodeRef = useRef(episode);
  const handledSyncHoldRef = useRef<string | null>(null);
  const joinedSyncHoldKeyRef = useRef<string | null>(null);
  const onGuestSyncRef = useRef(onGuestSync);
  onGuestSyncRef.current = onGuestSync;

  hostSeasonRef.current = season;
  hostEpisodeRef.current = episode;

  const applyGuestRoom = useCallback(
    (r: WatchPartyRoom, host: boolean) => {
      if (host || r.catalogId !== catalogId) {
        lastStateVersionRef.current = r.stateVersion;
        lastPlaybackVersionRef.current = r.playbackVersion ?? 0;
        lastSyncGenerationRef.current = r.syncGeneration ?? 0;
        return;
      }

      const plan = planGuestSync({
        room: {
          season: r.season,
          episode: r.episode,
          playbackSeconds: r.playbackSeconds,
          stateUpdatedAt: r.stateUpdatedAt,
          stateVersion: r.stateVersion,
          playbackVersion: r.playbackVersion ?? 0,
          syncGeneration: r.syncGeneration ?? 0,
          syncHold: normalizeSyncHold(r.syncHold),
        },
        lastStateVersion: lastStateVersionRef.current,
        lastPlaybackVersion: lastPlaybackVersionRef.current,
        lastSyncGeneration: lastSyncGenerationRef.current,
        lastAppliedSeconds: lastAppliedSecondsRef.current,
      });

      if (plan) {
        lastAppliedSecondsRef.current = plan.targetSeconds;
        onGuestSyncRef.current?.(plan);
      }

      lastStateVersionRef.current = r.stateVersion;
      lastPlaybackVersionRef.current = r.playbackVersion ?? 0;
      lastSyncGenerationRef.current = r.syncGeneration ?? 0;
    },
    [catalogId]
  );

  const pollRoom = useCallback(async (rid: string, mid: string) => {
    const qs = new URLSearchParams({ roomId: rid });
    if (mid) qs.set("memberId", mid);
    const res = await fetch(`/api/party?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.room as WatchPartyRoom | null;
  }, []);

  const joinRoom = useCallback(
    async (rid: string, nickname?: string) => {
      setLoading(true);
      setError("");
      try {
        const nick = (nickname ?? storedNickname()).trim() || "Guest";
        saveNickname(nick);
        const existing = storedMemberId(rid);
        const res = await fetch(`/api/party/${encodeURIComponent(rid)}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: nick, memberId: existing || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Join failed");
        saveMemberId(rid, data.memberId);
        const ht = storedHostToken(rid);
        const host = Boolean(ht);
        setRoom(data.room);
        setMemberId(data.memberId);
        setIsHost(host);
        if (!host) {
          lastAppliedSecondsRef.current = -1;
          if (data.room.syncHold?.active && data.room.syncHold.startedAt) {
            joinedSyncHoldKeyRef.current = data.room.syncHold.startedAt;
          }
          applyGuestRoom(data.room, false);
        } else {
          lastStateVersionRef.current = data.room.stateVersion;
          lastPlaybackVersionRef.current = data.room.playbackVersion ?? 0;
          lastSyncGenerationRef.current = data.room.syncGeneration ?? 0;
        }
        setHostToken(ht);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Join failed");
      } finally {
        setLoading(false);
      }
    },
    [applyGuestRoom]
  );

  const createRoom = useCallback(
    async (nickname?: string) => {
      setLoading(true);
      setError("");
      try {
        const nick = (nickname ?? storedNickname()).trim() || "Host";
        saveNickname(nick);
        const res = await fetch("/api/party", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalogId,
            mediaType,
            season,
            episode,
            nickname: nick,
            title,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Create failed");
        saveHostToken(data.roomId, data.hostToken);
        saveMemberId(data.roomId, data.hostMemberId);
        setHostToken(data.hostToken);
        setRoom(data.room);
        setMemberId(data.hostMemberId);
        setIsHost(true);
        lastStateVersionRef.current = data.room.stateVersion;
        lastPlaybackVersionRef.current = data.room.playbackVersion ?? 0;
        lastSyncGenerationRef.current = data.room.syncGeneration ?? 0;
        return data.roomId as string;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [catalogId, mediaType, season, episode, title]
  );

  const broadcastEpisode = useCallback(
    async (s: number, e: number, playbackSeconds?: number) => {
      if (!room?.roomId || !hostToken) return;
      const seconds =
        playbackSeconds != null
          ? playbackSeconds
          : Math.floor(hostPlaybackRef.current);
      try {
        const res = await fetch(`/api/party/${encodeURIComponent(room.roomId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-party-host-token": hostToken,
          },
          body: JSON.stringify({
            season: s,
            episode: e,
            title,
            playbackSeconds: seconds,
          }),
        });
        const data = await res.json();
        if (res.ok && data.room) {
          lastStateVersionRef.current = data.room.stateVersion;
          lastPlaybackVersionRef.current = data.room.playbackVersion ?? 0;
          setRoom(data.room);
        }
      } catch {
        /* ignore */
      }
    },
    [room?.roomId, hostToken, title]
  );

  const broadcastPlayback = useCallback(
    async (seconds: number) => {
      if (!room?.roomId || !hostToken) return;
      hostPlaybackRef.current = seconds;
      try {
        const res = await fetch(`/api/party/${encodeURIComponent(room.roomId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-party-host-token": hostToken,
          },
          body: JSON.stringify({ playbackSeconds: seconds }),
        });
        const data = await res.json();
        if (res.ok && data.room) {
          lastPlaybackVersionRef.current = data.room.playbackVersion ?? 0;
          setRoom(data.room);
        }
      } catch {
        /* ignore */
      }
    },
    [room?.roomId, hostToken]
  );

  const updateSettings = useCallback(
    async (settings: Partial<TeaPartySettings>) => {
      if (!room?.roomId || !hostToken) return;
      try {
        const res = await fetch(`/api/party/${encodeURIComponent(room.roomId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-party-host-token": hostToken,
          },
          body: JSON.stringify({ settings }),
        });
        const data = await res.json();
        if (res.ok && data.room) setRoom(data.room);
      } catch {
        /* ignore */
      }
    },
    [room?.roomId, hostToken]
  );

  const releaseSyncCheckpoint = useCallback(async () => {
    if (!room?.roomId || !hostToken) return;
    try {
      const res = await fetch(`/api/party/${encodeURIComponent(room.roomId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-party-host-token": hostToken,
        },
        body: JSON.stringify({
          releaseSyncHold: true,
          playbackSeconds: Math.floor(hostPlaybackRef.current),
          season: hostSeasonRef.current,
          episode: hostEpisodeRef.current,
        }),
      });
      const data = await res.json();
      if (res.ok && data.room) {
        lastSyncGenerationRef.current = data.room.syncGeneration ?? 0;
        lastPlaybackVersionRef.current = data.room.playbackVersion ?? 0;
        lastStateVersionRef.current = data.room.stateVersion;
        setRoom(data.room);
      }
    } catch {
      /* ignore */
    }
  }, [room?.roomId, hostToken]);

  const sendChat = useCallback(
    async (text: string) => {
      if (!room?.roomId || !memberId) return;
      const res = await fetch(
        `/api/party/${encodeURIComponent(room.roomId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, text }),
        }
      );
      if (res.ok) {
        const updated = await pollRoom(room.roomId, memberId);
        if (updated) setRoom(updated);
      }
    },
    [room?.roomId, memberId, pollRoom]
  );

  const leaveRoom = useCallback(() => {
    setRoom(null);
    setMemberId("");
    setHostToken("");
    setIsHost(false);
    lastStateVersionRef.current = 0;
    lastPlaybackVersionRef.current = 0;
    lastSyncGenerationRef.current = 0;
    lastAppliedSecondsRef.current = -1;
    handledSyncHoldRef.current = null;
    joinedSyncHoldKeyRef.current = null;
  }, []);

  const noteHostPlayback = useCallback((seconds: number) => {
    hostPlaybackRef.current = Math.max(0, Math.floor(seconds));
  }, []);

  useEffect(() => {
    if (!roomIdFromUrl || room) return;
    void joinRoom(roomIdFromUrl);
  }, [roomIdFromUrl, room, joinRoom]);

  useEffect(() => {
    if (!room?.roomId || !memberId) return;
    const id = window.setInterval(() => {
      void pollRoom(room.roomId, memberId).then((r) => {
        if (!r) return;
        if (!isHost && r.catalogId === catalogId) {
          applyGuestRoom(r, false);
        }
        setRoom(r);
      });
    }, PARTY_POLL_MS);
    return () => window.clearInterval(id);
  }, [room?.roomId, memberId, isHost, pollRoom, catalogId, applyGuestRoom]);

  useEffect(() => {
    if (!isHost || !room?.syncHold?.active) return;
    const key = room.syncHold.startedAt ?? "active";
    if (handledSyncHoldRef.current === key) return;
    handledSyncHoldRef.current = key;

    if (room.settings.onGuestJoin !== "auto_resume") return;

    const delayMs = (room.settings.autoResumeSeconds ?? 5) * 1000;
    const timer = window.setTimeout(() => {
      void releaseSyncCheckpoint();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    isHost,
    room?.syncHold?.active,
    room?.syncHold?.startedAt,
    room?.settings.onGuestJoin,
    room?.settings.autoResumeSeconds,
    releaseSyncCheckpoint,
  ]);

  const guestJoinSyncRole =
    !isHost && room?.syncHold?.active
      ? joinedSyncHoldKeyRef.current === room.syncHold.startedAt
        ? ("joiner" as const)
        : ("member" as const)
      : null;

  return {
    room,
    memberId,
    isHost,
    loading,
    error,
    guestJoinSyncRole,
    createRoom,
    joinRoom,
    leaveRoom,
    broadcastEpisode,
    broadcastPlayback,
    sendChat,
    updateSettings,
    releaseSyncCheckpoint,
    noteHostPlayback,
    nickname: storedNickname(),
    hostBroadcastIntervalMs: PARTY_HOST_BROADCAST_MS,
  };
}

export { normalizeTeaPartySettings, normalizeSyncHold };
