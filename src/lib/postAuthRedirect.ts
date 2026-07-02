const DEFAULT_POST_AUTH_PATH = "/explore";

/** Safe internal path for post-login redirect (?next=). */
export function postAuthDestination(next: string | null | undefined): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/login") &&
    !next.startsWith("/signup")
  ) {
    return next;
  }
  return DEFAULT_POST_AUTH_PATH;
}
