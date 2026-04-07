'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Alert } from '@heroui/react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
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
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 bg-background px-4 py-12">
        <p className="text-center text-default-600">This stream was not found.</p>
        <Button as={Link} href="/sports" color="success" variant="flat">
          Back to Sports
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background px-4 py-4 pb-32">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Button
            as={Link}
            href="/sports"
            variant="light"
            startContent={<ChevronLeftIcon className="h-4 w-4" />}
            className="w-fit min-w-0 -ml-2 text-default-600"
          >
            All sports
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-foreground">{stream.title}</h1>
          <p className="mt-1 text-sm text-default-500">{stream.description}</p>
        </div>

        <Alert
          color="success"
          variant="flat"
          isDefaultVisible
          hideIcon
          description="Use an ad blocker—third-party players show ads we don’t control."
        />

        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          <div className="relative h-full min-h-0 w-full overflow-hidden bg-black ring-1 ring-white/10">
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
      </div>
    </div>
  );
}
