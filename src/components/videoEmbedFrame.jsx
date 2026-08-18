'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
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
import { parseVidfastMessage } from '@/lib/vidfastProgress';
import { cn } from '@/lib/utils';
import { useWatchOverlay } from '@/contexts/watchOverlayContext';

/**
 * @param {object} props
 * @param {string} props.src
 * @param {string} [props.title]
 * @param {string} [props.className]
 * @param {(msg: import('@/lib/megaPlayProgress').MegaPlayMessage) => void} [props.onMegaPlayMessage]
 * @param {(progress: import('@/lib/vidrockProgress').VidrockProgress) => void} [props.onVidrockProgress]
 * @param {(progress: import('@/lib/vidfastProgress').VidfastProgress) => void} [props.onVidfastProgress]
 * @param {string} [props.vidrockTmdbId]
 * @param {number} [props.vidrockSeason]
 * @param {number} [props.vidrockEpisode]
 * @param {string} [props.vidukiImdbId]
 * @param {() => void} [props.onLoad]
 * @param {() => void} [props.onEmbedFailure] Called when MegaPlay errors or never reports progress
 * @param {() => void} [props.onEmbedProgress] Called on first MegaPlay progress tick
 * @param {number} [props.embedFailureTimeoutMs] No-progress timeout after iframe load
 */
const VideoEmbedFrame = forwardRef(function VideoEmbedFrame(
  {
    src,
    title,
    className = '',
    onMegaPlayMessage,
    onVidrockProgress,
    onVidfastProgress,
    vidrockTmdbId,
    vidrockSeason = 1,
    vidrockEpisode = 1,
    vidukiImdbId,
    onLoad,
    onEmbedFailure,
    onEmbedProgress,
    embedFailureTimeoutMs = 2200,
  },
  ref
) {
  const [activeSrc, setActiveSrc] = useState(src);
  const activeSrcRef = useRef(src);
  const watchOverlay = useWatchOverlay();
  const playbackStartedRef = useRef(false);
  const embedProgressRef = useRef(false);
  const embedFailedRef = useRef(false);
  const failureTimerRef = useRef(null);
  const onEmbedFailureRef = useRef(onEmbedFailure);
  const onEmbedProgressRef = useRef(onEmbedProgress);
  onEmbedFailureRef.current = onEmbedFailure;
  onEmbedProgressRef.current = onEmbedProgress;

  const clearFailureTimer = () => {
    if (failureTimerRef.current != null) {
      window.clearTimeout(failureTimerRef.current);
      failureTimerRef.current = null;
    }
  };

  const markEmbedProgress = () => {
    if (embedProgressRef.current) return;
    embedProgressRef.current = true;
    clearFailureTimer();
    onEmbedProgressRef.current?.();
  };

  useEffect(() => {
    setActiveSrc(src);
    activeSrcRef.current = src;
    playbackStartedRef.current = false;
    embedProgressRef.current = false;
    embedFailedRef.current = false;
    clearFailureTimer();
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
    return () => clearFailureTimer();
  }, []);

  const scheduleFailureTimer = () => {
    if (!onEmbedFailureRef.current || !activeSrcRef.current) return;
    clearFailureTimer();
    failureTimerRef.current = window.setTimeout(() => {
      reportEmbedFailure();
    }, embedFailureTimeoutMs);
  };

  const handleIframeLoad = () => {
    onLoad?.();
    scheduleFailureTimer();
  };

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
          markEmbedProgress();
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
      const vidfast = parseVidfastMessage(event);
      if (vidfast) {
        maybeNotifyPlaybackStart(vidfast.seconds);
        onVidfastProgress?.(vidfast);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    onMegaPlayMessage,
    onVidrockProgress,
    onVidfastProgress,
    vidrockTmdbId,
    vidrockSeason,
    vidrockEpisode,
    vidukiImdbId,
    watchOverlay,
  ]);

  if (!activeSrc) return null;

  let isVidfastEmbed = false;
  try {
    isVidfastEmbed = new URL(activeSrc).hostname.toLowerCase() === 'vidfast.vc';
  } catch {
    isVidfastEmbed = activeSrc.includes('vidfast.vc');
  }

  return (
    <iframe
      ref={ref}
      key={activeSrc}
      title={title}
      src={activeSrc}
      allow={EMBED_IFRAME_ALLOW}
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      className={cn(
        EMBED_IFRAME_CLASS,
        isVidfastEmbed && 'origin-center lg:[zoom:0.75]',
        className
      )}
      onLoad={handleIframeLoad}
    />
  );
});

export default VideoEmbedFrame;
