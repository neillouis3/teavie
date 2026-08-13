/** Primary home route after auth and logo links. */
export const EXPLORE_HOME = "/explore" as const;

export function isExplorePath(pathname: string): boolean {
  return pathname === EXPLORE_HOME || pathname.startsWith(`${EXPLORE_HOME}/`);
}
