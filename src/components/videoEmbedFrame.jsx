'use client';

import { useEffect } from 'react';
import {
  EMBED_IFRAME_ALLOW,
  EMBED_IFRAME_CLASS,
} from '@/lib/embedPlayerIframe';
import { parseMegaPlayMessage } from '@/lib/megaPlayProgress';
import { parseVidrockMessage } from '@/lib/vidrockProgress';
import { cn } from '@/lib/utils';

/**
 * @param {object} props
 * @param {string} props.src
 * @param {string} [props.title]
 * @param {string} [props.className]
 * @param {(msg: import('@/lib/megaPlayProgress').MegaPlayMessage) => void} [props.onMegaPlayMessage]
 * @param {(progress: import('@/lib/vidrockProgress').VidrockProgress) => void} [props.onVidrockProgress]
 * @param {string} [props.vidrockTmdbId]
 * @param {number} [props.vidrockSeason]
 * @param {number} [props.vidrockEpisode]
 * @param {() => void} [props.onLoad]
 */
export default function VideoEmbedFrame({
  src,
  title,
  className = '',
  onMegaPlayMessage,
  onVidrockProgress,
  vidrockTmdbId,
  vidrockSeason = 1,
  vidrockEpisode = 1,
  onLoad,
}) {
  useEffect(() => {
    if (!onMegaPlayMessage && !onVidrockProgress) return undefined;
    const handler = (event) => {
      if (onMegaPlayMessage) {
        const mega = parseMegaPlayMessage(event);
        if (mega) onMegaPlayMessage(mega);
      }
      if (onVidrockProgress) {
        const vidrock = parseVidrockMessage(
          event,
          String(vidrockTmdbId ?? ''),
          vidrockSeason,
          vidrockEpisode
        );
        if (vidrock) onVidrockProgress(vidrock);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    onMegaPlayMessage,
    onVidrockProgress,
    vidrockTmdbId,
    vidrockSeason,
    vidrockEpisode,
  ]);

  if (!src) return null;

  return (
    <iframe
      title={title}
      src={src}
      allow={EMBED_IFRAME_ALLOW}
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      className={cn(EMBED_IFRAME_CLASS, className)}
      onLoad={onLoad}
    />
  );
}
