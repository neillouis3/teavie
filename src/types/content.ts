// src/types/content.ts
export interface ContentItem {
  id: number | string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  type?: 'movie' | 'tv';
  runtimeSeconds?: number;
  season_amount?: number;
  /** Total episodes when known (TV / anime). */
  number_of_episodes?: number | null;
  vote_average?: number | null;
  genres?: string[];
  certification?: string | null;
}
  