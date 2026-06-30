/** Videasy iframe postMessage progress payloads — https://www.videasy.net/docs */

export type VideasyProgressMessage = {
  id?: string | number;
  type?: "movie" | "tv" | "anime" | string;
  progress?: number;
  timestamp: number;
  duration?: number;
  season?: number;
  episode?: number;
};

const VIDEASY_ORIGIN_RE = /^https:\/\/player\.videasy\.(to|net)$/;

export function isVideasyPlayerOrigin(origin: string): boolean {
  return VIDEASY_ORIGIN_RE.test(origin);
}

export function parseVideasyProgressMessage(
  event: MessageEvent
): VideasyProgressMessage | null {
  if (!isVideasyPlayerOrigin(event.origin)) return null;
  try {
    const raw = event.data;
    const data =
      typeof raw === "string"
        ? (JSON.parse(raw) as unknown)
        : raw;
    if (!data || typeof data !== "object") return null;
    const ts = Number((data as VideasyProgressMessage).timestamp);
    if (!Number.isFinite(ts) || ts < 0) return null;
    return data as VideasyProgressMessage;
  } catch {
    return null;
  }
}
