/**
 * TMDB read token. Prefer server-only `TMDB_BEARER` in API routes; fall back to
 * `NEXT_PUBLIC_TMDB_BEARER` (client bundles and local dev).
 *
 * v3 API keys (`TMDB_API_KEY`) work via `?apikey=` on requests when no bearer is set.
 */
export function tmdbBearerToken() {
  return process.env.TMDB_BEARER || process.env.NEXT_PUBLIC_TMDB_BEARER || "";
}

export function tmdbApiKey() {
  return process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
}

/** @returns {{ kind: "bearer" | "api_key"; value: string } | null} */
export function tmdbAuth() {
  const bearer = String(tmdbBearerToken()).trim();
  if (bearer) return { kind: "bearer", value: bearer };
  const apiKey = String(tmdbApiKey()).trim();
  if (apiKey) return { kind: "api_key", value: apiKey };
  return null;
}

export function hasTmdbAuth() {
  return Boolean(tmdbAuth());
}

/**
 * @param {string} url
 * @param {{ kind: "bearer" | "api_key"; value: string }} auth
 */
export function buildTmdbRequest(url, auth) {
  if (auth.kind === "bearer") {
    return {
      url,
      init: {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${auth.value}`,
        },
      },
    };
  }
  const u = new URL(url);
  u.searchParams.set("api_key", auth.value);
  return {
    url: u.toString(),
    init: { headers: { accept: "application/json" } },
  };
}

/**
 * @param {string} url
 * @param {{ kind: "bearer" | "api_key"; value: string } | string | null | undefined} [authOrBearer]
 */
export async function tmdbFetchJson(url, authOrBearer, { timeoutMs = 12000 } = {}) {
  /** @type {{ kind: "bearer" | "api_key"; value: string } | null} */
  let auth = null;
  if (authOrBearer && typeof authOrBearer === "object" && authOrBearer.kind) {
    auth = authOrBearer;
  } else if (typeof authOrBearer === "string" && authOrBearer.trim()) {
    auth = { kind: "bearer", value: authOrBearer.trim() };
  } else {
    auth = tmdbAuth();
  }
  if (!auth) throw new Error("Missing TMDB auth");

  const { url: finalUrl, init } = buildTmdbRequest(url, auth);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(finalUrl, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TMDB ${res.status}: ${t.slice(0, 160)}`);
  }
  return res.json();
}
