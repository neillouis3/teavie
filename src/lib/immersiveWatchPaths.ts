const MOVIE_WATCH_RE = /^\/movies\/[^/]+\/watch\/?$/;

/** Movie watch routes: full-viewport player with no app chrome. */
export function pathUsesImmersiveMovieWatch(pathname: string): boolean {
  return MOVIE_WATCH_RE.test(pathname);
}
