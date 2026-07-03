'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import SportsPlayer from '@/components/sports/sportsPlayer';
import { CONTENT_INSET_X } from '@/lib/contentInset';

export default function SportsPlayerPage() {
  const params = useParams();
  const matchId = typeof params?.matchId === 'string' ? params.matchId : '';

  useEffect(() => {
    document.title = matchId ? 'Sports - Teavie' : 'Sports - Teavie';
  }, [matchId]);

  return (
    <div className={`min-h-screen w-full ${CONTENT_INSET_X}`}>
      <SportsPlayer matchId={matchId} />
    </div>
  );
}
