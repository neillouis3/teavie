'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import SportsPlayer from '@/components/sports/sportsPlayer';

export default function SportsPlayerPage() {
  const params = useParams();
  const matchId = typeof params?.matchId === 'string' ? params.matchId : '';

  return <SportsPlayer matchId={matchId} />;
}
