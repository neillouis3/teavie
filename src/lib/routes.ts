/** Primary home route after auth and logo links. */
export const EXPLORE_HOME = "/explore" as const;

export const LIBRARY_HOME = "/library" as const;

export function isExplorePath(pathname: string): boolean {
  return pathname === EXPLORE_HOME || pathname.startsWith(`${EXPLORE_HOME}/`);
}

export function isLibraryPath(pathname: string): boolean {
  return pathname === LIBRARY_HOME || pathname.startsWith(`${LIBRARY_HOME}/`);
}
