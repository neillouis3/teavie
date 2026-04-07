'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Chip } from '@heroui/react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import Header from '@/components/ui/header';
import { EMBED_IFRAME_ALLOW } from '@/lib/embedPlayerIframe';
import { getSportsStreamBySlug } from '@/lib/sportsStreams';

export default function SportsStreamPlayerPage() {
  const params = useParams();
  const slug = typeof params?.stream === 'string' ? params.stream : '';
  const stream = useMemo(() => getSportsStreamBySlug(slug), [slug]);

  useEffect(() => {
    document.title = stream ? `${stream.title} - Sports - Teavie` : 'Sports - Teavie';
  }, [stream]);

  if (!stream) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-main">
        <Header pageName="Sports" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
          <p className="text-center text-sm text-default-500">This stream was not found.</p>
          <Button as={Link} href="/sports" color="primary" variant="flat">
            Back to Sports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-background px-4 py-4 pb-32">
      <div className="flex w-full flex-col gap-6">
        <Button
          as={Link}
          href="/sports"
          variant="light"
          startContent={<ChevronLeftIcon className="h-4 w-4" />}
          className="w-fit min-w-0 -ml-2 text-default-600"
        >
          All sports
        </Button>

        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
            <iframe
              title={`${stream.title} live stream`}
              src={stream.src}
              allow={EMBED_IFRAME_ALLOW}
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">
          <section>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{stream.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip color="success" size="md" variant="flat" className="font-medium">
                Live
              </Chip>
              <Chip size="md" variant="flat" className="font-medium">
                Sports
              </Chip>
            </div>
          </section>

          <section className="rounded-xl border border-default-200/50 bg-default-100/50 p-4 sm:p-5 dark:bg-default-100/20">
            <p className="text-sm leading-relaxed text-foreground/80 sm:text-base">{stream.description}</p>
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-default-200 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Playback</span>
              <p className="text-[11px] leading-relaxed text-foreground/60">
                Use an ad blocker—third-party players show ads we don&apos;t control.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
