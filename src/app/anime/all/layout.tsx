import React from 'react';

/** Shell (sidebar, offset) comes from root `Providers`; avoid duplicating sidebar + spacer. */
export default function AllAnimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
