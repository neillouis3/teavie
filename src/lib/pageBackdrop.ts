/** Static blurred-page backgrounds (public/, no TMDB fetch). */
export const PAGE_SHELL_BACKDROP = "/page-backdrops/shell.jpg";
export const PAGE_BROWSE_BACKDROP = "/page-backdrops/browse.jpg";
export const PAGE_SHOWS_BROWSE_BACKDROP = "/page-backdrops/shows.jpg";
export const PAGE_MOVIES_BROWSE_BACKDROP = "/page-backdrops/movies.jpg";
export const PAGE_ANIME_BROWSE_BACKDROP = "/page-backdrops/anime.jpg";
export const PAGE_KDRAMA_BROWSE_BACKDROP = "/page-backdrops/kdrama.jpg";
export const PAGE_PROFILE_BACKDROP = "/page-backdrops/profile.jpg";
export const PAGE_ACTIVITY_BACKDROP = "/page-backdrops/activity.jpg";
export const PAGE_SETTINGS_BACKDROP = "/page-backdrops/settings.jpg";

export type PageBrowseBackdrop = "browse" | "shows" | "movies" | "anime" | "kdrama";

export function pageBrowseBackdropUrl(variant: PageBrowseBackdrop): string {
  switch (variant) {
    case "shows":
      return PAGE_SHOWS_BROWSE_BACKDROP;
    case "movies":
      return PAGE_MOVIES_BROWSE_BACKDROP;
    case "anime":
      return PAGE_ANIME_BROWSE_BACKDROP;
    case "kdrama":
      return PAGE_KDRAMA_BROWSE_BACKDROP;
    default:
      return PAGE_BROWSE_BACKDROP;
  }
}

export type PageShellBackdrop =
  | "shell"
  | "profile"
  | "activity"
  | "settings";

export function pageShellBackdropUrl(variant: PageShellBackdrop): string {
  switch (variant) {
    case "profile":
      return PAGE_PROFILE_BACKDROP;
    case "activity":
      return PAGE_ACTIVITY_BACKDROP;
    case "settings":
      return PAGE_SETTINGS_BACKDROP;
    default:
      return PAGE_SHELL_BACKDROP;
  }
}
