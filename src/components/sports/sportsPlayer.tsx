'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Spinner } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FullSignalIcon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import SportsMatchPanel from '@/components/sports/sportsMatchPanel';
import WatchPageSkeleton from '@/components/ui/watchPageSkeleton';
import { WatchPlayerShell } from '@/components/ui/playerEmbedSkeleton';
import {
  fetchMatchById,
  fetchStreamsGrouped,
  type StreamedMatch,
  type StreamedStream,
} from '@/lib/streamedSports';
import { cn } from '@/lib/utils';

type SportsPlayerProps = {
  matchId: string;
};

function NoActiveServersState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-default-100/60 dark:bg-default-100/15">
        <HugeiconsIcon
          icon={FullSignalIcon}
          size={28}
          className="text-default-500"
          strokeWidth={1.5}
        />
      </div>
      <div className="flex max-w-sm flex-col items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">
          No active servers
        </h2>
        <p className="text-sm leading-relaxed text-default-500 sm:text-[15px]">
          No servers have active streams for this match
        </p>
      </div>
      <Button
        variant="bordered"
        className="mt-1 border-default-300 text-foreground dark:border-default-500/60"
        onPress={onRetry}
        isLoading={retrying}
        startContent={
          !retrying ? (
            <HugeiconsIcon icon={Refresh01Icon} size={16} className="shrink-0" />
          ) : undefined
        }
      >
        Check Again
      </Button>
    </div>
  );
}

export default function SportsPlayer({ matchId }: SportsPlayerProps) {
  const [match, setMatch] = useState<StreamedMatch | null>(null);
  const [streamsBySource, setStreamsBySource] = useState<
    Record<string, StreamedStream[]>
  >({});
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedStreamNo, setSelectedStreamNo] = useState<number>(1);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingMatch(true);
      setError(null);
      try {
        const row = await fetchMatchById(matchId);
        if (cancelled) return;
        if (!row) {
          setMatch(null);
          setError('This event was not found.');
          return;
        }
        setMatch(row);
      } catch {
        if (!cancelled) {
          setMatch(null);
          setError('Could not load this event.');
        }
      } finally {
        if (!cancelled) setLoadingMatch(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (match?.title) {
      document.title = `${match.title} - Sports - Teavie`;
    }
  }, [match?.title]);

  const loadStreams = useCallback(async () => {
    if (!match) return;
    setLoadingStreams(true);
    setError(null);
    try {
      const grouped = await fetchStreamsGrouped(match);
      setStreamsBySource(grouped);
      const firstSource = Object.keys(grouped)[0] ?? '';
      setSelectedSource(firstSource);
      const firstStream = firstSource ? grouped[firstSource]?.[0] : undefined;
      setSelectedStreamNo(firstStream?.streamNo ?? 1);
    } catch {
      setStreamsBySource({});
      setError('Could not load stream servers for this event.');
    } finally {
      setLoadingStreams(false);
    }
  }, [match]);

  useEffect(() => {
    if (!match) return;
    void loadStreams();
  }, [match, loadStreams]);

  const sourceKeys = useMemo(
    () => Object.keys(streamsBySource).filter((key) => streamsBySource[key]?.length),
    [streamsBySource]
  );

  const streamsForSource = selectedSource
    ? streamsBySource[selectedSource] ?? []
    : [];

  const activeStream =
    streamsForSource.find((stream) => stream.streamNo === selectedStreamNo) ??
    streamsForSource[0] ??
    null;

  useEffect(() => {
    if (activeStream?.embedUrl) setIframeLoading(true);
  }, [activeStream?.embedUrl]);

  if (loadingMatch) {
    return <WatchPageSkeleton />;
  }

  if (!match) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center bg-background px-6 py-12 text-center lg:min-h-[100dvh]">
        <div className="flex max-w-md flex-col items-center gap-4">
          <p className="text-sm leading-relaxed text-default-500 sm:text-[15px]">
            {error ?? 'This event was not found.'}
          </p>
          <Button
            as={Link}
            href="/sports"
            variant="bordered"
            className="border-default-300 text-foreground dark:border-default-500/60"
          >
            Back to Sports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      <div className="flex w-full flex-col gap-6">
        <WatchPlayerShell>
          <div className="relative h-full min-h-0 w-full touch-auto rounded-xl bg-black ring-1 ring-white/10 [touch-action:pan-x_pan-y_pinch-zoom] lg:overflow-hidden">
            {loadingStreams ? (
              <div className="absolute inset-0 flex items-center justify-center bg-default-200 dark:bg-default-100/20">
                <Spinner color="success" />
              </div>
            ) : activeStream?.embedUrl ? (
              <>
                <VideoEmbedFrame
                  key={activeStream.embedUrl}
                  title={`${match.title} live stream`}
                  src={activeStream.embedUrl}
                  onLoad={() => setIframeLoading(false)}
                  className={cn(
                    'absolute inset-0 h-full w-full border-0 transition-opacity duration-300',
                    iframeLoading ? 'opacity-0' : 'opacity-100'
                  )}
                />
                {iframeLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <Spinner color="success" />
                  </div>
                ) : null}
              </>
            ) : (
              <NoActiveServersState
                onRetry={() => void loadStreams()}
                retrying={loadingStreams}
              />
            )}
          </div>
        </WatchPlayerShell>

        <div className="w-full">
          <SportsMatchPanel
            match={match}
            sourceKeys={sourceKeys}
            streamsBySource={streamsBySource}
            selectedSource={selectedSource}
            selectedStreamNo={selectedStreamNo}
            onSourceChange={(source) => {
              setSelectedSource(source);
              const first = streamsBySource[source]?.[0];
              setSelectedStreamNo(first?.streamNo ?? 1);
            }}
            onStreamChange={setSelectedStreamNo}
          />
          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
