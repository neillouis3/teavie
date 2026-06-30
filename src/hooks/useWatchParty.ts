"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

import { PARTY_NICK_KEY } from "@/lib/partyNickname";

const NICK_KEY = PARTY_NICK_KEY;
const MEMBER_PREFIX = "teavie.party.member.";
const HOST_PREFIX = "teavie.party.hostToken.";

function storedNickname() {
  if (typeof window === "undefined") return "Guest";
  try {
    return localStorage.getItem(NICK_KEY)?.trim() || "Guest";
  } catch {
    return "Guest";
  }
}

function saveNickname(n: string) {
  try {
    localStorage.setItem(NICK_KEY, n.slice(0, 32));
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
  onGuestEpisode?: (season: number, episode: number) => void;
  onGuestPlayback?: (season: number, episode: number, seconds: number) => void;
};

export function useWatchParty({
  catalogId,
  mediaType,
  title = "",
  season = 1,
  episode = 1,
  roomIdFromUrl,
  onGuestEpisode,
  onGuestPlayback,
}: UseWatchPartyOpts) {
  const [room, setRoom] = useState<WatchPartyRoom | null>(null);
  const [memberId, setMemberId] = useState("");
  const [hostToken, setHostToken] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastVersionRef = useRef(0);
  const lastPlaybackVersionRef = useRef(0);
  const onGuestEpisodeRef = useRef(onGuestEpisode);
  const onGuestPlaybackRef = useRef(onGuestPlayback);
  onGuestEpisodeRef.current = onGuestEpisode;
  onGuestPlaybackRef.current = onGuestPlayback;

  const pollRoom = useCallback(async (rid: string, mid: string) => {
    const qs = new URLSearchParams({ roomId: rid });
    if (mid) qs.set("memberId", mid);
    const res = await fetch(`/api/party?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.room as WatchPartyRoom | null;
  }, []);

  const applyRoom = useCallback(
    (r: WatchPartyRoom, mid: string, host: boolean) => {
      setRoom(r);
      if (!host && r.catalogId === catalogId) {
        if (r.stateVersion > lastVersionRef.current) {
          onGuestEpisodeRef.current?.(r.season, r.episode);
          onGuestPlaybackRef.current?.(r.season, r.episode, r.playbackSeconds ?? 0);
        } else if (
          r.playbackVersion > lastPlaybackVersionRef.current &&
          (mediaType === "tv" || mediaType === "movie")
        ) {
          onGuestPlaybackRef.current?.(r.season, r.episode, r.playbackSeconds ?? 0);
        }
      }
      lastVersionRef.current = r.stateVersion;
      lastPlaybackVersionRef.current = r.playbackVersion ?? 0;
      setMemberId(mid);
      setIsHost(host);
    },
    [catalogId, mediaType]
  );

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
        applyRoom(data.room, data.memberId, Boolean(ht));
        setHostToken(ht);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Join failed");
      } finally {
        setLoading(false);
      }
    },
    [applyRoom]
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
        applyRoom(data.room, data.hostMemberId, true);
        return data.roomId as string;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyRoom, catalogId, mediaType, season, episode, title]
  );

  const broadcastEpisode = useCallback(
    async (s: number, e: number, playbackSeconds = 0) => {
      if (!room?.roomId || !hostToken) return;
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
            playbackSeconds,
          }),
        });
        const data = await res.json();
        if (res.ok && data.room) {
          lastVersionRef.current = data.room.stateVersion;
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
    lastVersionRef.current = 0;
    lastPlaybackVersionRef.current = 0;
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
          if (r.stateVersion > lastVersionRef.current) {
            onGuestEpisodeRef.current?.(r.season, r.episode);
            onGuestPlaybackRef.current?.(r.season, r.episode, r.playbackSeconds ?? 0);
          } else if (
            r.playbackVersion > lastPlaybackVersionRef.current &&
            (mediaType === "tv" || mediaType === "movie")
          ) {
            onGuestPlaybackRef.current?.(r.season, r.episode, r.playbackSeconds ?? 0);
          }
        }
        lastVersionRef.current = r.stateVersion;
        lastPlaybackVersionRef.current = r.playbackVersion ?? 0;
        setRoom(r);
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [room?.roomId, memberId, isHost, pollRoom, catalogId, mediaType]);

  return {
    room,
    memberId,
    isHost,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    broadcastEpisode,
    broadcastPlayback,
    sendChat,
    nickname: storedNickname(),
  };
}
