// src/types/content.ts
export interface ContentItem {
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string;
    backdrop_path?: string;
    overview?: string;
    type?: "movie" | "tv";
    runtimeSeconds?: number;
    season_amount?: number;
  }
  