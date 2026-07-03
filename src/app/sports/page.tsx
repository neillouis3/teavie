'use client';

import React, { useEffect } from 'react';
import SportsHub from '@/components/sports/sportsHub';

export default function SportsPage() {
  useEffect(() => {
    document.title = 'Sports - Teavie';
  }, []);

  return <SportsHub />;
}
