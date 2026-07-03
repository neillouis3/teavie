export const STREAMED_BASE = 'https://streamed.pk';

export type StreamedSport = {
  id: string;
  name: string;
};

export type StreamedSourceRef = {
  source: string;
  id: string;
};

export type StreamedTeam = {
  name: string;
  badge?: string;
};

export type StreamedMatch = {
  id: string;
  title: string;
  category: string;
  date: number;
  status?: string | null;
  teams?: {
    home?: StreamedTeam;
    away?: StreamedTeam;
  };
  sources?: StreamedSourceRef[];
};

export type StreamedStream = {
  id?: string;
  streamNo: number;
  language?: string;
  hd?: boolean;
  source: string;
  viewers?: number;
  embedUrl: string;
};

export type SportsViewFilter = 'popular' | 'live' | 'all' | 'today';

async function streamedGet<T>(path: string): Promise<T> {
  const res = await fetch(`${STREAMED_BASE}${path}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Streamed request failed: ${path} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchStreamedSports(): Promise<StreamedSport[]> {
  try {
    return await streamedGet<StreamedSport[]>('/api/sports');
  } catch {
    return [];
  }
}

export async function fetchMatchesAll(): Promise<StreamedMatch[]> {
  try {
    return await streamedGet<StreamedMatch[]>('/api/matches/all');
  } catch {
    return [];
  }
}

export async function fetchMatchesPopular(): Promise<StreamedMatch[]> {
  try {
    return await streamedGet<StreamedMatch[]>('/api/matches/all/popular');
  } catch {
    return [];
  }
}

export async function fetchMatchesToday(): Promise<StreamedMatch[]> {
  try {
    return await streamedGet<StreamedMatch[]>('/api/matches/all-today');
  } catch {
    return [];
  }
}

export async function fetchMatchesLive(): Promise<StreamedMatch[]> {
  try {
    return await streamedGet<StreamedMatch[]>('/api/matches/live');
  } catch {
    return [];
  }
}

export async function fetchMatchesBySport(sportId: string): Promise<StreamedMatch[]> {
  try {
    return await streamedGet<StreamedMatch[]>(`/api/matches/${sportId}`);
  } catch {
    return [];
  }
}

export async function fetchPopularBySport(sportId: string): Promise<StreamedMatch[]> {
  try {
    return await streamedGet<StreamedMatch[]>(`/api/matches/${sportId}/popular`);
  } catch {
    return [];
  }
}

export async function fetchMatchById(matchId: string): Promise<StreamedMatch | null> {
  const lists = await Promise.all([
    fetchMatchesAll(),
    fetchMatchesPopular(),
    fetchMatchesToday(),
    fetchMatchesLive(),
  ]);
  for (const list of lists) {
    const found = list.find((m) => m.id === matchId);
    if (found) return found;
  }
  return null;
}

export async function fetchStreams(
  source: string,
  sourceId: string
): Promise<Omit<StreamedStream, 'source'>[]> {
  try {
    return await streamedGet<Omit<StreamedStream, 'source'>[]>(
      `/api/stream/${source}/${sourceId}`
    );
  } catch {
    return [];
  }
}

export async function fetchStreamsGrouped(
  match: StreamedMatch
): Promise<Record<string, StreamedStream[]>> {
  const refs = match.sources ?? [];
  if (refs.length === 0) return {};

  const available = (
    await Promise.all(
      refs.map(async (ref) => {
        try {
          const streams = await fetchStreams(ref.source, ref.id);
          if (streams.length > 0) {
            return { ref, streams };
          }
        } catch {
          /* skip unavailable source */
        }
        return null;
      })
    )
  ).filter((row): row is { ref: StreamedSourceRef; streams: Omit<StreamedStream, 'source'>[] } =>
    Boolean(row)
  );

  const grouped: Record<string, StreamedStream[]> = {};
  for (const { ref, streams } of available) {
    grouped[ref.source] = streams.map((stream, index) => ({
      ...stream,
      source: ref.source,
      id: stream.id || `${ref.source}_${ref.id}_${index + 1}`,
      streamNo: stream.streamNo ?? index + 1,
    }));
  }
  return grouped;
}

export function streamedBadgeUrl(badge?: string | null): string {
  if (!badge) return '';
  const stem = badge.replace(/\.(webp|png|jpg|jpeg)$/i, '');
  return `${STREAMED_BASE}/api/images/badge/${stem}.webp`;
}

export function matchCardImageUrl(match: StreamedMatch): string {
  const home = streamedBadgeUrl(match.teams?.home?.badge);
  if (home) return home;
  const away = streamedBadgeUrl(match.teams?.away?.badge);
  if (away) return away;
  return '';
}

export function sportLabel(category: string): string {
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatMatchDate(ms: number): string {
  if (!ms) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

/** Live if kickoff was within the last 3 hours. */
export function isMatchLive(match: StreamedMatch, now = Date.now()): boolean {
  const kickoff = match.date;
  if (!kickoff) return false;
  return kickoff <= now && now - kickoff < 3 * 60 * 60 * 1000;
}

export function isMatchUpcoming(match: StreamedMatch, now = Date.now()): boolean {
  return Boolean(match.date && match.date > now);
}

export function matchDescription(match: StreamedMatch): string {
  const parts = [sportLabel(match.category), formatMatchDate(match.date)];
  if (isMatchLive(match)) parts.push('Live now');
  else if (isMatchUpcoming(match)) parts.push('Upcoming');
  return parts.filter(Boolean).join(' · ');
}

export async function loadSportsMatches(
  sportId: string,
  view: SportsViewFilter
): Promise<StreamedMatch[]> {
  if (sportId === 'all') {
    if (view === 'popular') return fetchMatchesPopular();
    if (view === 'live') return fetchMatchesLive();
    if (view === 'today') return fetchMatchesToday();
    return fetchMatchesAll();
  }

  if (view === 'popular') return fetchPopularBySport(sportId);
  const rows = await fetchMatchesBySport(sportId);
  if (view === 'live') {
    return rows.filter((m) => m.status === 'live' || isMatchLive(m));
  }
  return rows;
}

export function filterMatches(query: string, matches: StreamedMatch[]): StreamedMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return matches;
  return matches.filter((match) => {
    const title = match.title?.toLowerCase() ?? '';
    const home = match.teams?.home?.name?.toLowerCase() ?? '';
    const away = match.teams?.away?.name?.toLowerCase() ?? '';
    const category = match.category?.toLowerCase() ?? '';
    return title.includes(q) || home.includes(q) || away.includes(q) || category.includes(q);
  });
}

export function sourceLabel(source: string): string {
  if (!source) return 'Server';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function streamLabel(stream: StreamedStream): string {
  const parts = [`Stream ${stream.streamNo}`];
  if (stream.language?.trim()) parts.push(stream.language.trim());
  if (stream.hd) parts.push('HD');
  if (typeof stream.viewers === 'number' && stream.viewers > 0) {
    parts.push(`${stream.viewers.toLocaleString()} watching`);
  }
  return parts.join(' · ');
}
