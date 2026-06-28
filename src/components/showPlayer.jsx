'use client';

import { useMemo } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from '@/components/ui/streamQualityBadge';
import {
  VIDEASY_PLAYER_BASE,
  VIDEASY_TV_QUERY,
} from '@/lib/videasyPlayer';

/** VidCore — https://vidcore.net (TMDB ids; theme is hex without #) */
const VIDCORE_TV_QUERY = '?theme=22c55e&autoPlay=true';

export const SHOW_SERVERS = {
  videasy: {
    base: VIDEASY_PLAYER_BASE,
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDEASY_TV_QUERY,
  },
  vidcore: {
    base: 'https://vidcore.net',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDCORE_TV_QUERY,
  },
};

/**
 * @param {{ server: string; videoId?: string; season: number; episode: number }} p
 */
function buildEmbedUrl(p) {
  const { server, videoId, season, episode } = p;

  try {
    const cfg = SHOW_SERVERS[server] ?? SHOW_SERVERS.videasy;
    const id = String(videoId ?? '').trim();
    if (!/^\d+$/.test(id)) {
      return { url: '', error: 'Missing TMDB TV id' };
    }
    const s = Math.max(0, Math.floor(Number(season)) || 0);
    const e = Math.max(1, Math.floor(Number(episode)) || 1);
    const path = cfg.path(id, s, e);
    const suffix = typeof cfg.suffix === 'function' ? cfg.suffix() : '';
    return { url: `${cfg.base}${path}${suffix}`, error: null };
  } catch (e) {
    return { url: '', error: e?.message || 'Unknown error' };
  }
}

/**
 * @param {object} props
 * @param {string} [props.videoId] TMDB TV id
 * @param {number} props.season
 * @param {number} props.episode
 * @param {string} [props.server]
 */
export default function ShowPlayer({
  videoId,
  season,
  episode,
  server = 'videasy',
}) {
  const { url, error } = useMemo(
    () =>
      buildEmbedUrl({
        server,
        videoId,
        season,
        episode,
      }),
    [server, videoId, season, episode]
  );

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      <StreamQualityBadge quality="hd" />
      {url ? (
        <VideoEmbedFrame
          key={url}
          title="Episode player"
          src={url}
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
  );
}
