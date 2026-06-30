/** MegaPlay / animeplay.cfd iframe postMessage events */

export type MegaPlayProgress = {
  kind: "progress";
  currentTime: number;
  duration?: number;
  percent?: number;
};

export type MegaPlayComplete = { kind: "complete" };

export type MegaPlayError = { kind: "error"; message?: string };

export type MegaPlayMessage = MegaPlayProgress | MegaPlayComplete | MegaPlayError;

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

export function isMegaPlayPlayerOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "animeplay.cfd" ||
      host.endsWith(".animeplay.cfd") ||
      host.includes("megaplay") ||
      host.includes("megacloud")
    );
  } catch {
    return false;
  }
}

export function isMegaPlayEmbedUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  try {
    return isMegaPlayPlayerOrigin(new URL(u).origin);
  } catch {
    return /animeplay\.cfd|megaplay/i.test(u);
  }
}

export function parseMegaPlayMessage(event: MessageEvent): MegaPlayMessage | null {
  if (!isMegaPlayPlayerOrigin(event.origin)) return null;
  const data = parseMessageData(event.data);
  if (!data) return null;

  const payload =
    data.channel === "megacloud" && data.event != null
      ? data
      : data;

  const eventName = payload.event;
  if (eventName === "complete") return { kind: "complete" };
  if (eventName === "error") {
    return {
      kind: "error",
      message: typeof payload.message === "string" ? payload.message : undefined,
    };
  }

  if (eventName === "time") {
    const currentTime = Number(payload.time);
    if (!Number.isFinite(currentTime) || currentTime < 0) return null;
    return {
      kind: "progress",
      currentTime,
      duration: Number.isFinite(Number(payload.duration))
        ? Number(payload.duration)
        : undefined,
      percent: Number.isFinite(Number(payload.percent))
        ? Number(payload.percent)
        : undefined,
    };
  }

  if (data.type === "watching-log") {
    const currentTime = Number(data.currentTime);
    if (!Number.isFinite(currentTime) || currentTime < 0) return null;
    return {
      kind: "progress",
      currentTime,
      duration: Number.isFinite(Number(data.duration))
        ? Number(data.duration)
        : undefined,
    };
  }

  return null;
}
