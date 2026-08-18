import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { VidrockProgress } from "@/lib/vidrockProgress";
import type { VidfastProgress } from "@/lib/vidfastProgress";

export type ShowPlayerProps = {
  videoId?: string;
  imdbId?: string | null;
  title?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  season: number;
  episode: number;
  server?: string;
  startSeconds?: number;
  immersive?: boolean;
  onStremioProgress?: (seconds: number) => void;
  onVidrockProgress?: (progress: VidrockProgress) => void;
  onVidfastProgress?: (progress: VidfastProgress) => void;
  onEmbedLoad?: () => void;
};

declare const ShowPlayer: ForwardRefExoticComponent<
  ShowPlayerProps & RefAttributes<HTMLIFrameElement>
>;

export default ShowPlayer;

export const SHOW_SERVERS: Record<
  string,
  {
    base: string;
    path: (id: string, season: number, episode: number) => string;
    suffix: () => string;
  }
>;
