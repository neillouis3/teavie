'use client';

import { useCallback, useMemo } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from '@/components/ui/streamQualityBadge';
import {
  VIDEASY_PLAYER_BASE,
  VIDEASY_TV_QUERY_PREFIX,
  withVideasyProgress,
} from '@/lib/videasyPlayer';

/** Peachify — https://peachify.pro (TMDB ids) */
const PEACHIFY_BASE = 'https://peachify.pro';

/** VidCore — https://vidcore.net (TMDB ids; theme is hex without #) */
const VIDCORE_TV_QUERY = '?theme=22c55e&autoPlay=true';

export const SHOW_SERVERS = {
  peachify: {
    base: PEACHIFY_BASE,
    path: (id, season, episode) => `/embed/tv/${id}/${season}/${episode}`,
    suffix: () => '',
    supportsProgress: false,
  },
  videasy: {
    base: VIDEASY_PLAYER_BASE,
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDEASY_TV_QUERY_PREFIX,
    supportsProgress: true,
  },
  vidcore: {
    base: 'https://vidcore.net',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDCORE_TV_QUERY,
    supportsProgress: false,
  },
};

/**
 * @param {{ server: string; videoId?: string; season: number; episode: number; startSeconds?: number }} p
 */
function buildEmbedUrl(p) {
  const { server, videoId, season, episode, startSeconds } = p;

  try {
    const cfg = SHOW_SERVERS[server] ?? SHOW_SERVERS.peachify;
    const id = String(videoId ?? '').trim();
    if (!/^\d+$/.test(id)) {
      return { url: '', error: 'Missing TMDB TV id' };
    }
    const s = Math.max(0, Math.floor(Number(season)) || 0);
    const e = Math.max(1, Math.floor(Number(episode)) || 1);
    const path = cfg.path(id, s, e);
    let suffix = typeof cfg.suffix === 'function' ? cfg.suffix() : '';
    if (cfg.supportsProgress && startSeconds > 0) {
      suffix = withVideasyProgress(suffix, { progress: startSeconds });
    }
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
 * @param {number} [props.startSeconds] Videasy resume position
 * @param {(msg: import('@/lib/videasyProgress').VideasyProgressMessage) => void} [props.onVideasyProgress]
 */
export default function ShowPlayer({
  videoId,
  season,
  episode,
  server = 'peachify',
  startSeconds = 0,
  onVideasyProgress,
}) {
  const progressHandler = useCallback(
    (msg) => {
      onVideasyProgress?.(msg);
    },
    [onVideasyProgress]
  );

  const { url, error } = useMemo(
    () =>
      buildEmbedUrl({
        server,
        videoId,
        season,
        episode,
        startSeconds: server === 'videasy' ? startSeconds : 0,
      }),
    [server, videoId, season, episode, startSeconds]
  );

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full touch-auto rounded-lg bg-black ring-1 ring-white/10 [touch-action:pan-x_pan-y_pinch-zoom] lg:overflow-hidden">
      <StreamQualityBadge quality="hd" />
      {url ? (
        <VideoEmbedFrame
          key={url}
          title="Episode player"
          src={url}
          className="absolute inset-0 h-full w-full border-0"
          onVideasyProgress={server === 'videasy' ? progressHandler : undefined}
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
  );
}
