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
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-default-100/80 p-1 dark:bg-white/8"
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
                ? 'cursor-not-allowed bg-transparent text-default-400 opacity-45 dark:text-white/30'
                : selected
                ? 'bg-default-200/80 text-foreground shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-default-500 hover:text-foreground dark:text-white/60 dark:hover:text-white'
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
  const { server: streamServer, setServer: setStreamServer, hydrated: streamHydrated } = useStreamingSource();
  const { audio: animeAudio, setAudio: setAnimeAudio } = useAnimeAudio();
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
      backdrop="settings"
      contentClassName="space-y-5"
    >
      <PageCard title="Appearance">
        <PageCardRow label="Theme">
          {!mounted ? (
            <div className="h-9 w-40 animate-pulse rounded-lg bg-default-200 dark:bg-white/10" />
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
          {!mounted || !streamHydrated ? (
            <div className="h-9 w-56 animate-pulse rounded-lg bg-white/10" />
          ) : (
            <SegmentControl
              options={STREAM_SERVER_OPTIONS}
              value={streamServer}
              onChange={setStreamServer}
              label={streamServerLabel}
            />
          )}
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
