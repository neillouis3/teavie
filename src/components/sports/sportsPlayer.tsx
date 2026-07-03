'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Chip, Select, SelectItem, Spinner } from '@heroui/react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import {
  fetchMatchById,
  fetchStreamsGrouped,
  formatMatchDate,
  isMatchLive,
  matchCardImageUrl,
  sourceLabel,
  sportLabel,
  streamLabel,
  streamedBadgeUrl,
  type StreamedMatch,
  type StreamedStream,
} from '@/lib/streamedSports';
import { cn } from '@/lib/utils';

type SportsPlayerProps = {
  matchId: string;
};

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
    if (!match) return;
    let cancelled = false;
    void (async () => {
      setLoadingStreams(true);
      setError(null);
      try {
        const grouped = await fetchStreamsGrouped(match);
        if (cancelled) return;
        setStreamsBySource(grouped);
        const firstSource = Object.keys(grouped)[0] ?? '';
        setSelectedSource(firstSource);
        const firstStream = firstSource ? grouped[firstSource]?.[0] : undefined;
        setSelectedStreamNo(firstStream?.streamNo ?? 1);
      } catch {
        if (!cancelled) {
          setStreamsBySource({});
          setError('Could not load stream servers for this event.');
        }
      } finally {
        if (!cancelled) setLoadingStreams(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match]);

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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner color="success" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-sm text-default-500">
          {error ?? 'This event was not found.'}
        </p>
        <Button as={Link} href="/sports" color="success" variant="flat">
          Back to Sports
        </Button>
      </div>
    );
  }

  const live = isMatchLive(match);
  const poster = matchCardImageUrl(match);

  return (
    <div className="flex min-h-full w-full flex-col bg-background pb-32">
      <div className="flex w-full flex-col gap-6">
        <div className="px-0">
          <Button
            as={Link}
            href="/sports"
            variant="light"
            size="sm"
            className="mb-2 text-default-500"
          >
            ← Back to Sports
          </Button>
        </div>

        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
            {loadingStreams || !activeStream?.embedUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner color="success" />
              </div>
            ) : (
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <Spinner color="success" />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {match.teams?.home?.badge ? (
                <img
                  src={streamedBadgeUrl(match.teams.home.badge)}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
              ) : null}
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {match.title}
              </h1>
              {match.teams?.away?.badge ? (
                <img
                  src={streamedBadgeUrl(match.teams.away.badge)}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {live ? (
                <Chip color="success" size="md" variant="flat" className="font-medium">
                  Live
                </Chip>
              ) : (
                <Chip size="md" variant="flat" className="font-medium">
                  {formatMatchDate(match.date)}
                </Chip>
              )}
              <Chip size="md" variant="flat" className="font-medium">
                {sportLabel(match.category)}
              </Chip>
            </div>

            {poster ? (
              <p className="text-sm text-default-500">
                {match.teams?.home?.name && match.teams?.away?.name
                  ? `${match.teams.home.name} vs ${match.teams.away.name}`
                  : null}
              </p>
            ) : null}
          </section>

          {sourceKeys.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-xl border border-default-200 bg-default-50/80 p-4 dark:border-white/10 dark:bg-default-100/10">
              <p className="text-sm font-medium text-foreground">Stream servers</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Source"
                  selectedKeys={selectedSource ? [selectedSource] : []}
                  onSelectionChange={(keys) => {
                    const next = Array.from(keys)[0];
                    if (typeof next !== 'string' || !next) return;
                    setSelectedSource(next);
                    const first = streamsBySource[next]?.[0];
                    setSelectedStreamNo(first?.streamNo ?? 1);
                  }}
                  radius="sm"
                  variant="bordered"
                  classNames={{
                    trigger:
                      'border-default-300 bg-background dark:border-white/10',
                  }}
                >
                  {sourceKeys.map((source) => (
                    <SelectItem key={source}>{sourceLabel(source)}</SelectItem>
                  ))}
                </Select>

                <Select
                  label="Server"
                  selectedKeys={
                    activeStream ? [String(activeStream.streamNo)] : []
                  }
                  onSelectionChange={(keys) => {
                    const next = Number(Array.from(keys)[0]);
                    if (Number.isFinite(next) && next > 0) setSelectedStreamNo(next);
                  }}
                  radius="sm"
                  variant="bordered"
                  isDisabled={streamsForSource.length === 0}
                  classNames={{
                    trigger:
                      'border-default-300 bg-background dark:border-white/10',
                  }}
                >
                  {streamsForSource.map((stream) => (
                    <SelectItem key={String(stream.streamNo)}>
                      {streamLabel(stream)}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </section>
          ) : !loadingStreams ? (
            <p className="text-sm text-default-500">
              No stream servers are available for this event right now.
            </p>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
