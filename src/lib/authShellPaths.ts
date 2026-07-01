/** Routes that render without app chrome (sidebar, nav, footer). */
export const AUTH_SHELL_PATHS = ["/login", "/signup"] as const;

export function pathUsesAuthShell(pathname: string): boolean {
  return AUTH_SHELL_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
