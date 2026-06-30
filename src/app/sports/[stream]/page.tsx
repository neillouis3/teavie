'use client';

import React, { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Chip } from '@heroui/react';
import Header from '@/components/ui/header';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pr-4 py-16">
          <p className="text-center text-sm text-default-500">This stream was not found.</p>
          
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-background pr-4 pt-0 pb-32">
      <div className="flex w-full flex-col gap-6">

        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
            <VideoEmbedFrame
              title={`${stream.title} live stream`}
              src={stream.src}
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

          
        </div>
      </div>
    </div>
  );
}
