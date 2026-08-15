const IMMERSIVE_WATCH_RE = /^\/(movies|shows)\/[^/]+\/watch\/?$/;

/** Movie and show watch routes: full-viewport player with no app chrome. */
export function pathUsesImmersiveWatch(pathname: string): boolean {
  return IMMERSIVE_WATCH_RE.test(pathname);
}

/** @deprecated Use pathUsesImmersiveWatch */
export function pathUsesImmersiveMovieWatch(pathname: string): boolean {
  return pathUsesImmersiveWatch(pathname);
}
