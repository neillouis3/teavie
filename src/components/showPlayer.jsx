'use client';

import { useMemo } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from "@/components/ui/streamQualityBadge";
import WatchPlayerBackButton from "@/components/ui/watchPlayerBackButton";
import StremioPlayer from "@/components/stremioPlayerLazy";
import {
  MOVIES111_EMBED_BASE,
  PEACHIFY_EMBED_BASE,
  VIDCORE_EMBED_BASE,
  VIDCORE_THEME_QUERY,
  VIDROCK_EMBED_BASE,
  VIDROCK_TV_QUERY,
} from '@/lib/embedHosts';

export const SHOW_SERVERS = {
  vidrock: {
    base: VIDROCK_EMBED_BASE,
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDROCK_TV_QUERY,
  },
  movies111: {
    base: MOVIES111_EMBED_BASE,
    path: (id, season, episode) => `/embed/tv/${id}/${season}/${episode}`,
    suffix: () => '',
  },
  peachify: {
    base: PEACHIFY_EMBED_BASE,
    path: (id, season, episode) => `/embed/tv/${id}/${season}/${episode}`,
    suffix: () => '',
  },
  vidcore: {
    base: VIDCORE_EMBED_BASE,
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDCORE_THEME_QUERY,
  },
};

/**
 * @param {{ server: string; videoId?: string; season: number; episode: number }} p
 */
function buildEmbedUrl(p) {
  const { server, videoId, season, episode } = p;

  try {
    const cfg = SHOW_SERVERS[server] ?? SHOW_SERVERS.vidrock;
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
 * @param {string | null} [props.imdbId] IMDb title id used by Stremio addons
 * @param {string} [props.title]
 * @param {string | null} [props.posterUrl]
 * @param {string | null} [props.backdropUrl]
 * @param {number} props.season
 * @param {number} props.episode
 * @param {string} [props.server]
 * @param {number} [props.startSeconds] Stremio resume position
 * @param {(seconds: number) => void} [props.onStremioProgress]
 * @param {(progress: import('@/lib/vidrockProgress').VidrockProgress) => void} [props.onVidrockProgress]
 * @param {() => void} [props.onEmbedLoad]
 */
export default function ShowPlayer({
  videoId,
  imdbId,
  title,
  posterUrl,
  backdropUrl,
  season,
  episode,
  server = 'vidrock',
  startSeconds = 0,
  onStremioProgress,
  onVidrockProgress,
  onEmbedLoad,
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

  if (server === 'stremio') {
    return (
      <div className="relative h-full min-h-0 w-full">
        <WatchPlayerBackButton />
        <StremioPlayer
          type="series"
          imdbId={imdbId}
          catalogKey={videoId != null ? String(videoId) : null}
          season={season}
          episode={episode}
          startSeconds={startSeconds}
          title={title}
          posterUrl={posterUrl}
          backdropUrl={backdropUrl}
          onPlaybackProgress={onStremioProgress}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full touch-auto rounded-lg bg-black ring-1 ring-white/10 [touch-action:pan-x_pan-y_pinch-zoom] lg:overflow-hidden">
      <WatchPlayerBackButton />
      <StreamQualityBadge quality="hd" className="left-auto right-2 top-2 sm:right-3 sm:top-3" />
      {url ? (
        <VideoEmbedFrame
          key={url}
          title="Episode player"
          src={url}
          className="absolute inset-0 h-full w-full border-0"
          vidrockTmdbId={String(videoId ?? '')}
          vidrockSeason={season}
          vidrockEpisode={episode}
          onVidrockProgress={server === 'vidrock' ? onVidrockProgress : undefined}
          onLoad={onEmbedLoad}
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
  );
}
