'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EMBED_IFRAME_ALLOW,
  EMBED_IFRAME_CLASS,
} from '@/lib/embedPlayerIframe';
import { nextVidukiEmbedUrl } from '@/lib/embedHosts';
import { parseMegaPlayMessage } from '@/lib/megaPlayProgress';
import {
  isVidukiAllServersFailed,
  parseVidrockMessage,
} from '@/lib/vidrockProgress';
import { cn } from '@/lib/utils';
import { useWatchOverlay } from '@/contexts/watchOverlayContext';

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
 * @param {string} [props.vidukiImdbId]
 * @param {() => void} [props.onLoad]
 * @param {() => void} [props.onEmbedFailure] Called when MegaPlay errors or never reports progress
 * @param {number} [props.embedFailureTimeoutMs] No-progress timeout for MegaPlay embeds
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
  vidukiImdbId,
  onLoad,
  onEmbedFailure,
  embedFailureTimeoutMs = 8000,
}) {
  const [activeSrc, setActiveSrc] = useState(src);
  const activeSrcRef = useRef(src);
  const watchOverlay = useWatchOverlay();
  const playbackStartedRef = useRef(false);
  const embedProgressRef = useRef(false);
  const embedFailedRef = useRef(false);
  const onEmbedFailureRef = useRef(onEmbedFailure);
  onEmbedFailureRef.current = onEmbedFailure;

  useEffect(() => {
    setActiveSrc(src);
    activeSrcRef.current = src;
    playbackStartedRef.current = false;
    embedProgressRef.current = false;
    embedFailedRef.current = false;
  }, [src]);

  const reportEmbedFailure = () => {
    if (embedFailedRef.current || embedProgressRef.current) return;
    embedFailedRef.current = true;
    onEmbedFailureRef.current?.();
  };

  const maybeNotifyPlaybackStart = (seconds) => {
    if (playbackStartedRef.current || !watchOverlay) return;
    if (Number(seconds) >= 1) {
      playbackStartedRef.current = true;
      watchOverlay.notifyPlaybackStart();
    }
  };

  useEffect(() => {
    if (!watchOverlay || playbackStartedRef.current) return undefined;
    const timer = window.setTimeout(() => {
      if (!playbackStartedRef.current) {
        playbackStartedRef.current = true;
        watchOverlay.notifyPlaybackStart();
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeSrc, watchOverlay]);

  useEffect(() => {
    if (!onEmbedFailure || !activeSrc) return undefined;
    const timer = window.setTimeout(() => {
      reportEmbedFailure();
    }, embedFailureTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [activeSrc, embedFailureTimeoutMs, onEmbedFailure]);

  useEffect(() => {
    const handler = (event) => {
      if (isVidukiAllServersFailed(event)) {
        const next = nextVidukiEmbedUrl(activeSrcRef.current, vidukiImdbId);
        if (next) {
          activeSrcRef.current = next;
          setActiveSrc(next);
        }
      }
      const mega = parseMegaPlayMessage(event);
      if (mega) {
        if (mega.kind === 'progress') {
          embedProgressRef.current = true;
          maybeNotifyPlaybackStart(mega.currentTime);
        } else if (mega.kind === 'error') {
          reportEmbedFailure();
        }
        onMegaPlayMessage?.(mega);
      }
      const vidrock = parseVidrockMessage(
        event,
        String(vidrockTmdbId ?? ''),
        vidrockSeason,
        vidrockEpisode
      );
      if (vidrock) {
        maybeNotifyPlaybackStart(vidrock.seconds);
        if (onVidrockProgress) onVidrockProgress(vidrock);
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
    vidukiImdbId,
    watchOverlay,
  ]);

  if (!activeSrc) return null;

  return (
    <iframe
      key={activeSrc}
      title={title}
      src={activeSrc}
      allow={EMBED_IFRAME_ALLOW}
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      className={cn(EMBED_IFRAME_CLASS, className)}
      onLoad={onLoad}
    />
  );
}
