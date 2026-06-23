'use client';

import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ShowTemplate from '@/components/showTemplate';

function AdminShowPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const adminKey = searchParams.get('key')?.trim() ?? '';

  if (!params || typeof params.id !== 'string') {
    return (
      <div className="py-12 text-center text-sm text-default-500">
        Invalid show ID.
      </div>
    );
  }

  if (!adminKey) {
    return (
      <div className="mx-auto max-w-lg py-16 px-4 text-center">
        <p className="text-sm leading-relaxed text-default-600">
          Admin preview requires your secret key in the URL:
        </p>
        <p className="mt-3 break-all rounded-lg bg-default-100 px-3 py-2 font-mono text-xs text-default-700 dark:bg-default-50/10">
          /shows/admin/{params.id}?key=YOUR_TEAVIE_ADMIN_KEY
        </p>
      </div>
    );
  }

  return (
    <ShowTemplate
      id={params.id}
      adminKey={adminKey}
      adminPreview
    />
  );
}

export default function AdminShowPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-default-500">Loading…</div>
      }
    >
      <AdminShowPageInner />
    </Suspense>
  );
}
