/** Client-side Tea Party playback sync helpers. */

export const PARTY_POLL_MS = 1500;
export const PARTY_HOST_BROADCAST_MS = 2000;
export const PARTY_REMOUNT_DRIFT_SEC = 35;

export type TeaPartyGuestJoinMode = "off" | "auto_resume" | "host_resume";

export type TeaPartyGuestSyncRole = "joiner" | "member" | null;

export type TeaPartySettings = {
  onGuestJoin: TeaPartyGuestJoinMode;
  autoResumeSeconds: number;
};

export type TeaPartySyncHold = {
  active: boolean;
  startedAt: string | null;
  triggerNickname: string | null;
};

export const DEFAULT_TEA_PARTY_SETTINGS: TeaPartySettings = {
  onGuestJoin: "auto_resume",
  autoResumeSeconds: 5,
};

export function extrapolatePlaybackSeconds(
  playbackSeconds: number,
  stateUpdatedAt: string,
  nowMs: number = Date.now()
): number {
  const base = Math.max(0, Math.floor(Number(playbackSeconds)) || 0);
  const at = Date.parse(stateUpdatedAt);
  if (!Number.isFinite(at)) return base;
  const elapsed = Math.max(0, Math.floor((nowMs - at) / 1000));
  return base + elapsed;
}

export function normalizeTeaPartySettings(raw: unknown): TeaPartySettings {
  const src =
    raw && typeof raw === "object" ? (raw as Partial<TeaPartySettings>) : {};
  const mode = src.onGuestJoin;
  const onGuestJoin: TeaPartyGuestJoinMode =
    mode === "off" || mode === "auto_resume" || mode === "host_resume"
      ? mode
      : DEFAULT_TEA_PARTY_SETTINGS.onGuestJoin;
  const autoResumeSeconds = Math.min(
    30,
    Math.max(3, Math.floor(Number(src.autoResumeSeconds)) || 5)
  );
  return { onGuestJoin, autoResumeSeconds };
}

export function normalizeSyncHold(raw: unknown): TeaPartySyncHold {
  const src = raw && typeof raw === "object" ? (raw as Partial<TeaPartySyncHold>) : {};
  return {
    active: Boolean(src.active),
    startedAt: typeof src.startedAt === "string" ? src.startedAt : null,
    triggerNickname:
      typeof src.triggerNickname === "string" ? src.triggerNickname : null,
  };
}

export type GuestSyncPayload = {
  season: number;
  episode: number;
  targetSeconds: number;
  remount: boolean;
};

export function planGuestSync(args: {
  room: {
    season: number;
    episode: number;
    playbackSeconds: number;
    stateUpdatedAt: string;
    stateVersion: number;
    playbackVersion: number;
    syncGeneration: number;
    syncHold: TeaPartySyncHold;
  };
  lastStateVersion: number;
  lastPlaybackVersion: number;
  lastSyncGeneration: number;
  lastAppliedSeconds: number;
}): GuestSyncPayload | null {
  if (args.room.syncHold.active) return null;

  const target = extrapolatePlaybackSeconds(
    args.room.playbackSeconds,
    args.room.stateUpdatedAt
  );

  if (args.room.syncGeneration > args.lastSyncGeneration) {
    return {
      season: args.room.season,
      episode: args.room.episode,
      targetSeconds: target,
      remount: true,
    };
  }

  if (args.room.stateVersion > args.lastStateVersion) {
    return {
      season: args.room.season,
      episode: args.room.episode,
      targetSeconds: target,
      remount: true,
    };
  }

  if (args.room.playbackVersion > args.lastPlaybackVersion) {
    const drift =
      args.lastAppliedSeconds < 0
        ? Number.POSITIVE_INFINITY
        : Math.abs(target - args.lastAppliedSeconds);
    if (drift >= PARTY_REMOUNT_DRIFT_SEC) {
      return {
        season: args.room.season,
        episode: args.room.episode,
        targetSeconds: target,
        remount: true,
      };
    }
  }

  return null;
}
