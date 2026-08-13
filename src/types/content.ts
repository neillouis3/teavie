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
  /** Catalog anime rows (`anime_*` ids). */
  is_anime?: boolean;
  runtimeSeconds?: number;
  season_amount?: number;
  /** Total episodes when known (TV / anime). */
  number_of_episodes?: number | null;
  vote_average?: number | null;
  genres?: string[];
  imdb_genres?: string[];
  original_language?: string | null;
  origin_country?: string[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  omdb?: { genre?: string | null; language?: string | null; country?: string | null };
  certification?: string | null;
  last_air_date?: string;
  /** TV / anime lifecycle label from catalog (e.g. Returning Series). */
  status?: string;
}
  