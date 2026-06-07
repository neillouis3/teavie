'use client';

import { useMemo } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';

const VIDEASY_TV_QUERY =
  '?color=22c55e&nextEpisode=true&episodeSelector=true&overlay=true';
const VIDKING_QUERY = '?color=22c55e&nextEpisode=true&episodeSelector=true';
const VIDEASY_ANIME_QUERY =
  '?color=22c55e&nextEpisode=true&episodeSelector=true&overlay=true';

export const SHOW_SERVERS = {
  videasy: {
    base: 'https://player.videasy.to',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDEASY_TV_QUERY,
    animePath: (anilistId, absoluteEpisode) =>
      `/anime/${anilistId}/${Math.max(1, absoluteEpisode)}`,
    animeMoviePath: (anilistId) => `/anime/${anilistId}`,
    suffixAnime: () => VIDEASY_ANIME_QUERY,
  },
  vidking: {
    base: 'https://www.vidking.net',
    path: (id, season, episode) => `/embed/tv/${id}/${season}/${episode}`,
    suffix: () => VIDKING_QUERY,
  },
  '111movies': {
    base: 'https://111movies.com',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
  },
  moviesapi: {
    base: 'https://moviesapi.club',
    path: (id, season, episode) => `/tv/${id}-${season}-${episode}`,
  },
};

/**
 * @param {{
 *   source: 'tmdb' | 'anilist';
 *   server: string;
 *   videoId?: string;
 *   season: number;
 *   episode: number;
 *   anilistId?: number;
 *   absoluteEpisode: number;
 *   animeMovie: boolean;
 * }} p
 */
function buildEmbedUrl(p) {
  const {
    source,
    server,
    videoId,
    season,
    episode,
    anilistId,
    absoluteEpisode,
    animeMovie,
  } = p;

  const anilistOk =
    source === 'anilist' &&
    typeof anilistId === 'number' &&
    Number.isFinite(anilistId) &&
    anilistId > 0;

  try {
    if (anilistOk) {
      let cfg = SHOW_SERVERS[server] ?? SHOW_SERVERS.videasy;
      if (typeof cfg.animePath !== 'function') cfg = SHOW_SERVERS.videasy;

      let path;
      if (animeMovie && typeof cfg.animeMoviePath === 'function') {
        path = cfg.animeMoviePath(anilistId);
      } else if (typeof cfg.animePath === 'function') {
        const abs = Math.max(
          1,
          Math.floor(Number(absoluteEpisode)) || Math.floor(Number(episode)) || 1
        );
        path = cfg.animePath(anilistId, abs);
      } else {
        return { url: '', error: 'No anime player for this server' };
      }
      const sfx =
        typeof cfg.suffixAnime === 'function' ? cfg.suffixAnime : cfg.suffix;
      const suffix = typeof sfx === 'function' ? sfx() : '';
      return { url: `${cfg.base}${path}${suffix}`, error: null };
    }

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
 * @param {string} [props.videoId]
 * @param {number} props.season
 * @param {number} props.episode
 * @param {string} [props.server]
 * @param {'tmdb' | 'anilist'} [props.source]
 * @param {number} [props.anilistId]
 * @param {number} [props.absoluteEpisode]
 * @param {boolean} [props.animeMovie]
 */
export default function ShowPlayer({
  videoId,
  season,
  episode,
  server = 'videasy',
  source = 'tmdb',
  anilistId,
  absoluteEpisode = 1,
  animeMovie = false,
}) {
  const { url, error } = useMemo(
    () =>
      buildEmbedUrl({
        source,
        server,
        videoId,
        season,
        episode,
        anilistId,
        absoluteEpisode,
        animeMovie,
      }),
    [
      source,
      server,
      videoId,
      season,
      episode,
      anilistId,
      absoluteEpisode,
      animeMovie,
    ]
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
      {url ? (
        <VideoEmbedFrame
          key={url}
          title="Episode player"
          src={url}
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-white/70">
          Loading player…
        </p>
      )}
    </div>
  );
}
