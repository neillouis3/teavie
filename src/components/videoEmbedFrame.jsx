'use client';

import { useEffect } from 'react';
import {
  EMBED_IFRAME_ALLOW,
  EMBED_IFRAME_CLASS,
} from '@/lib/embedPlayerIframe';
import { parseVideasyProgressMessage } from '@/lib/videasyProgress';
import { parseMegaPlayMessage } from '@/lib/megaPlayProgress';
import { cn } from '@/lib/utils';

/**
 * @param {object} props
 * @param {string} props.src
 * @param {string} [props.title]
 * @param {string} [props.className]
 * @param {(msg: import('@/lib/videasyProgress').VideasyProgressMessage) => void} [props.onVideasyProgress]
 * @param {(msg: import('@/lib/megaPlayProgress').MegaPlayMessage) => void} [props.onMegaPlayMessage]
 * @param {() => void} [props.onLoad]
 */
export default function VideoEmbedFrame({
  src,
  title,
  className = '',
  onVideasyProgress,
  onMegaPlayMessage,
  onLoad,
}) {
  useEffect(() => {
    if (!onVideasyProgress && !onMegaPlayMessage) return undefined;
    const handler = (event) => {
      if (onVideasyProgress) {
        const videasy = parseVideasyProgressMessage(event);
        if (videasy) onVideasyProgress(videasy);
      }
      if (onMegaPlayMessage) {
        const mega = parseMegaPlayMessage(event);
        if (mega) onMegaPlayMessage(mega);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onVideasyProgress, onMegaPlayMessage]);

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
