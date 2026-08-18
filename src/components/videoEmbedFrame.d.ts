import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { MegaPlayMessage } from "@/lib/megaPlayProgress";
import type { VidrockProgress } from "@/lib/vidrockProgress";
import type { VidfastProgress } from "@/lib/vidfastProgress";

export type VideoEmbedFrameProps = {
  src: string;
  title?: string;
  className?: string;
  onMegaPlayMessage?: (msg: MegaPlayMessage) => void;
  onVidrockProgress?: (progress: VidrockProgress) => void;
  onVidfastProgress?: (progress: VidfastProgress) => void;
  vidrockTmdbId?: string;
  vidrockSeason?: number;
  vidrockEpisode?: number;
  vidukiImdbId?: string | null;
  onLoad?: () => void;
  onEmbedFailure?: () => void;
  onEmbedProgress?: () => void;
  embedFailureTimeoutMs?: number;
};

declare const VideoEmbedFrame: ForwardRefExoticComponent<
  VideoEmbedFrameProps & RefAttributes<HTMLIFrameElement>
>;

export default VideoEmbedFrame;
