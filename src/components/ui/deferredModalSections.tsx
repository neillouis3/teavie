"use client";

import React, { useEffect, useState } from "react";

/** Defer heavy modal rails until after the primary details paint. */
export default function DeferredModalSections({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 480 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => setReady(true), 160);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
