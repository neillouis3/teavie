'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  LayoutGridIcon,
  LayoutTwoRowIcon,
  Moon02Icon,
  Sun03Icon,
} from '@hugeicons/core-free-icons';
import UserPageShell from '@/components/ui/userPageShell';
import { PageCard, PageCardRow } from '@/components/ui/pageCard';
import {
  useCatalogCardStyle,
  type CatalogCardLayoutMode,
} from '@/contexts/catalogCardStyleContext';
import {
  ANIME_AUDIO_OPTIONS,
  useAnimeAudio,
} from '@/contexts/animeAudioContext';
import {
  ANIME_SOURCE_OPTIONS,
  animeSourceLabel,
  useAnimeSource,
} from '@/contexts/animeSourceContext';
import {
  STREAM_SERVER_OPTIONS,
  streamServerLabel,
  useStreamingSource,
} from '@/contexts/streamingSourceContext';
import { animeAudioLabel } from '@/lib/animePlayEmbed';
import CatalogStreamingOutageAlert from '@/components/ui/catalogStreamingOutageAlert';
import { cn } from '@/lib/utils';

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  label,
  icon,
  disabled,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: (id: T) => string;
  icon?: (id: T) => React.ReactNode;
  disabled?: (id: T) => boolean;
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-white/8 p-1"
      role="group"
    >
      {options.map((id) => {
        const selected = value === id;
        const optionDisabled = disabled?.(id) ?? false;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={optionDisabled}
            aria-pressed={selected}
            aria-disabled={optionDisabled}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              optionDisabled
                ? 'cursor-not-allowed bg-transparent text-white/30 opacity-45'
                : selected
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            )}
          >
            {icon?.(id)}
            {label(id)}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { mode: cardLayout, setMode: setCardLayout } = useCatalogCardStyle();
  const { server: streamServer, setServer: setStreamServer } = useStreamingSource();
  const { audio: animeAudio, setAudio: setAnimeAudio } = useAnimeAudio();
  const { source: animeSource, setSource: setAnimeSource } = useAnimeSource();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.title = 'Settings - Teavie';
  }, []);

  const activeTheme = (theme ?? resolvedTheme ?? 'dark') as string;
  const cardLayoutOptions = ['vertical', 'horizontal'] as const satisfies readonly CatalogCardLayoutMode[];

  return (
    <UserPageShell
      title="Settings"
      description="Appearance and playback preferences for this device."
      contentClassName="space-y-5"
    >
      <PageCard title="Appearance">
        <PageCardRow label="Theme">
          {!mounted ? (
            <div className="h-9 w-40 animate-pulse rounded-lg bg-white/10" />
          ) : (
            <SegmentControl
              options={['light', 'dark'] as const}
              value={activeTheme === 'dark' ? 'dark' : 'light'}
              onChange={(next) => setTheme(next)}
              label={(id) => (id === 'light' ? 'Light' : 'Dark')}
              icon={(id) => (
                <HugeiconsIcon
                  icon={id === 'light' ? Sun03Icon : Moon02Icon}
                  size={16}
                  className="shrink-0"
                />
              )}
            />
          )}
        </PageCardRow>

        <PageCardRow label="Catalog cards">
          <SegmentControl
            options={cardLayoutOptions}
            value={cardLayout}
            onChange={setCardLayout}
            label={(id) => (id === 'vertical' ? 'Vertical' : 'Horizontal')}
            icon={(id) => (
              <HugeiconsIcon
                icon={id === 'vertical' ? LayoutGridIcon : LayoutTwoRowIcon}
                size={16}
                className="shrink-0"
              />
            )}
          />
        </PageCardRow>
      </PageCard>

      <PageCard
        title="Playback"
        footer="Third-party players may show ads we don't control. Settings are saved on this device."
      >
        <div className="px-4 pb-2 pt-1 sm:px-6">
          <CatalogStreamingOutageAlert />
        </div>
        <PageCardRow label="Movies & TV">
          <SegmentControl
            options={STREAM_SERVER_OPTIONS}
            value={streamServer}
            onChange={setStreamServer}
            label={streamServerLabel}
            disabled={(id) => id === 'stremio'}
          />
        </PageCardRow>

        <PageCardRow label="Anime player">
          <SegmentControl
            options={ANIME_SOURCE_OPTIONS}
            value={animeSource}
            onChange={setAnimeSource}
            label={animeSourceLabel}
          />
        </PageCardRow>

        <PageCardRow label="Anime audio">
          <SegmentControl
            options={ANIME_AUDIO_OPTIONS}
            value={animeAudio}
            onChange={setAnimeAudio}
            label={animeAudioLabel}
          />
        </PageCardRow>
      </PageCard>
    </UserPageShell>
  );
}
