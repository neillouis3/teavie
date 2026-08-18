import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { VidrockProgress } from "@/lib/vidrockProgress";
import type { VidfastProgress } from "@/lib/vidfastProgress";

export type MoviePlayerProps = {
  videoId: string | number;
  imdbId?: string | null;
  title?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  server?: string;
  startSeconds?: number;
  immersive?: boolean;
  hideBackButton?: boolean;
  onStremioProgress?: (seconds: number) => void;
  onVidrockProgress?: (progress: VidrockProgress) => void;
  onVidfastProgress?: (progress: VidfastProgress) => void;
  onEmbedLoad?: () => void;
};

declare const MoviePlayer: ForwardRefExoticComponent<
  MoviePlayerProps & RefAttributes<HTMLIFrameElement>
>;

export default MoviePlayer;

export const MOVIE_SERVERS: Record<
  string,
  {
    base: string;
    path: (id: string) => string;
    suffix: () => string;
  }
>;
