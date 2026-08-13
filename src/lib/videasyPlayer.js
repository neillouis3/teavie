/** Videasy embed host — https://www.videasy.net/docs */
export const VIDEASY_PLAYER_BASE = 'https://player.videasy.to';

const VIDEASY_COLOR = 'color=22c55e';
const VIDEASY_OVERLAY = 'overlay=true';
const VIDEASY_AUTOPLAY = 'autoPlay=true';

/** Brand accent + Netflix-style pause overlay */
export const VIDEASY_MOVIE_QUERY = `?${VIDEASY_COLOR}&${VIDEASY_OVERLAY}&${VIDEASY_AUTOPLAY}`;

export const VIDEASY_TV_QUERY = [
  VIDEASY_COLOR,
  VIDEASY_OVERLAY,
  VIDEASY_AUTOPLAY,
  'nextEpisode=true',
  'episodeSelector=true',
  'autoplayNextEpisode=true',
].join('&');

export const VIDEASY_TV_QUERY_PREFIX = `?${VIDEASY_TV_QUERY}`;

/**
 * Append Videasy query flags (progress start time in seconds).
 * @param {string} suffix Existing `?a=1&b=2` suffix
 * @param {{ progress?: number }} [opts]
 */
export function withVideasyProgress(suffix, opts = {}) {
  const sec = Math.floor(Number(opts.progress));
  if (!Number.isFinite(sec) || sec <= 0) return suffix;
  const join = suffix.includes('?') ? '&' : '?';
  return `${suffix}${join}progress=${sec}`;
}
