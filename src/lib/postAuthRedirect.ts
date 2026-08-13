import { EXPLORE_HOME } from "@/lib/routes";

const DEFAULT_POST_AUTH_PATH = EXPLORE_HOME;

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
