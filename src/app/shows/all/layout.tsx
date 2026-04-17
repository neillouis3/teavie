import React from 'react';

/** Shell (sidebar, offset) comes from root `Providers`; avoid duplicating sidebar + spacer. */
export default function AllShowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
