import React from 'react';

/** Shell (sidebar, offset) comes from root `Providers`; this layout only scopes the segment. */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
