'use client';
import { useEffect, useState } from 'react';
import { EMBED_IFRAME_ALLOW } from '@/lib/embedPlayerIframe';

/** Videasy TV — https://www.videasy.net/docs — overlay = Netflix-style pause overlay */
const VIDEASY_TV_QUERY =
  '?color=22c55e&nextEpisode=true&episodeSelector=true&overlay=true';

const VIDKING_QUERY = '?color=22c55e&nextEpisode=true&episodeSelector=true';

/** Videasy anime: https://www.videasy.net/docs — /anime/{anilistId}/{episode} or /anime/{anilistId} for films */
const VIDEASY_ANIME_QUERY = '?color=22c55e&nextEpisode=true&episodeSelector=true&overlay=true';

export const SHOW_SERVERS = {
  videasy: {
    base: 'https://player.videasy.net',
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
 * @param {object} props
 * @param {string} [props.videoId] TMDB TV id when using TV embed
 * @param {number} props.season
 * @param {number} props.episode TMDB embed episode index (running / cumulative across prior seasons when Teavie uses continuous labels; same as within-season when only one season)
 * @param {string} [props.server]
 * @param {'tmdb' | 'anilist'} [props.source] Embed id type (default tmdb)
 * @param {number} [props.anilistId] AniList media id when source is anilist
 * @param {number} [props.absoluteEpisode] 1-based cumulative episode for AniList series embeds
 * @param {boolean} [props.animeMovie] AniList one-shot / movie URL (no episode segment)
 */
const ShowPlayer = ({
  videoId,
  season,
  episode,
  server = 'videasy',
  source = 'tmdb',
  anilistId,
  absoluteEpisode,
  animeMovie = false,
}) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [error, setError] = useState(null);

  const useAnilist =
    source === 'anilist' &&
    typeof anilistId === 'number' &&
    Number.isFinite(anilistId) &&
    anilistId > 0;

  /** TMDB TV embed: only recompute when TMDB coordinates change (not AniList-only props). */
  useEffect(() => {
    if (useAnilist) return;
    try {
      let config = SHOW_SERVERS[server] ?? SHOW_SERVERS.videasy;
      const id = String(videoId ?? '').trim();
      if (!/^\d+$/.test(id)) {
        throw new Error('Missing TMDB TV id');
      }
      const s = Math.max(0, Math.floor(Number(season)) || 0);
      const e = Math.max(1, Math.floor(Number(episode)) || 1);
      const path = config.path(id, s, e);
      const suffix = typeof config.suffix === 'function' ? config.suffix() : '';
      const nextUrl = `${config.base}${path}${suffix}`;
      setPlayerUrl((prev) => (prev === nextUrl ? prev : nextUrl));
      setError(null);
    } catch (err) {
      console.error('Error setting player URL:', err);
      setError(err.message || 'Unknown error');
    }
  }, [useAnilist, videoId, season, episode, server]);

  /** AniList / anime embed path. */
  useEffect(() => {
    if (!useAnilist) return;
    try {
      let config = SHOW_SERVERS[server] ?? SHOW_SERVERS.videasy;
      if (typeof config.animePath !== 'function') {
        config = SHOW_SERVERS.videasy;
      }

      let path;
      let suffix = '';
      if (animeMovie && typeof config.animeMoviePath === 'function') {
        path = config.animeMoviePath(anilistId);
      } else if (typeof config.animePath === 'function') {
        const abs = Math.max(
          1,
          Math.floor(Number(absoluteEpisode)) || Math.floor(Number(episode)) || 1
        );
        path = config.animePath(anilistId, abs);
      } else {
        throw new Error('No AniList player for this server');
      }
      const sfx =
        typeof config.suffixAnime === 'function' ? config.suffixAnime : config.suffix;
      suffix = typeof sfx === 'function' ? sfx() : '';

      const nextUrl = `${config.base}${path}${suffix}`;
      setPlayerUrl((prev) => (prev === nextUrl ? prev : nextUrl));
      setError(null);
    } catch (err) {
      console.error('Error setting player URL:', err);
      setError(err.message || 'Unknown error');
    }
  }, [useAnilist, server, anilistId, absoluteEpisode, animeMovie, episode]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      {playerUrl ? (
        <iframe
          key={playerUrl}
          title="Episode player"
          src={playerUrl}
          allow={EMBED_IFRAME_ALLOW}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-white/70">
          Loading player…
        </p>
      )}
    </div>
  );
};

export default ShowPlayer;
