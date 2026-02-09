'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ShowTemplate from '@/components/showTemplate';

const ShowPage = () => {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid show ID</div>;
  }

  const showId = params.id;

  return <ShowTemplate id={showId} />;
};

export default ShowPage;


