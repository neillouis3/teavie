/** VidFast iframe postMessage: PLAYER_EVENT in, play/pause/seek commands out. */

export const VIDFAST_PLAYER_ORIGINS = [
  "https://vidfast.vc",
  "https://vidfast.pro",
  "https://vidfast.in",
  "https://vidfast.io",
  "https://vidfast.me",
  "https://vidfast.net",
  "https://vidfast.pm",
  "https://vidfast.xyz",
  "https://vidfast.bz",
] as const;

export type VidfastPlayerCommand = "play" | "pause" | "seek" | "getStatus" | "mute" | "volume";

export type VidfastProgress = {
  event: string;
  seconds: number;
  duration?: number;
  tmdbId?: string;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  playing?: boolean;
  muted?: boolean;
  volume?: number;
};

function parseMessageData(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function isVidfastPlayerOrigin(origin: string): boolean {
  try {
    const normalized = new URL(origin).origin;
    return VIDFAST_PLAYER_ORIGINS.some((allowed) => allowed === normalized);
  } catch {
    return false;
  }
}

function asSeconds(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function asCoord(raw: unknown, fallback: number): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Parse a VidFast parent-window PLAYER_EVENT message. */
export function parseVidfastMessage(event: MessageEvent): VidfastProgress | null {
  if (!isVidfastPlayerOrigin(event.origin)) return null;
  const data = parseMessageData(event.data);
  if (!data || data.type !== "PLAYER_EVENT") return null;

  const payload =
    data.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : data;

  const seconds = asSeconds(payload.currentTime);
  if (seconds == null) return null;

  const eventName = typeof payload.event === "string" ? payload.event : "timeupdate";
  const playing =
    typeof payload.playing === "boolean"
      ? payload.playing
      : eventName === "play"
        ? true
        : eventName === "pause" || eventName === "ended"
          ? false
          : undefined;

  const rawId = payload.mtmdbId ?? payload.tmdbId ?? payload.id;
  const tmdbId = Number.isFinite(Number(rawId)) ? String(Math.trunc(Number(rawId))) : undefined;

  return {
    event: eventName,
    seconds,
    duration: asSeconds(payload.duration) ?? undefined,
    tmdbId,
    mediaType: payload.mediaType === "tv" ? "tv" : payload.mediaType === "movie" ? "movie" : undefined,
    season: payload.season != null ? asCoord(payload.season, 1) : undefined,
    episode: payload.episode != null ? asCoord(payload.episode, 1) : undefined,
    playing,
    muted: typeof payload.muted === "boolean" ? payload.muted : undefined,
    volume: Number.isFinite(Number(payload.volume)) ? Number(payload.volume) : undefined,
  };
}

/** Send a control command into a VidFast embed iframe. */
export function postVidfastCommand(
  iframe: HTMLIFrameElement | null | undefined,
  command: VidfastPlayerCommand,
  time?: number
): void {
  if (!iframe?.contentWindow) return;
  const payload: Record<string, unknown> = { command };
  if (command === "seek" && time != null) {
    payload.time = Math.max(0, Math.floor(Number(time)) || 0);
  }
  if (command === "volume" && time != null) {
    payload.volume = Math.max(0, Math.min(1, Number(time)));
  }
  iframe.contentWindow.postMessage(payload, "*");
}
