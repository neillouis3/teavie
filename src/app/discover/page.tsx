'use client';

import React, { useEffect, useState } from "react";
import Explore from "@/components/explore";
import PageSplash from "@/components/ui/pageSplash";
import { fetchDiscoverFeed } from "@/lib/pageDataCache";
import type { ContentItem } from "@/types/content";

export default function DiscoverPage() {
  const [newContent, setNewContent] = useState<ContentItem[]>([]);
  const [updatedContent, setUpdatedContent] = useState<ContentItem[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<ContentItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Discover - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchDiscoverFeed().then((data) => {
      if (cancelled) return;
      setNewContent(data.newContent);
      setUpdatedContent(data.updatedContent);
      setUpcomingContent(data.upcomingContent);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <PageSplash ariaLabel="Loading Discover" />;
  }

  return (
    <div className="h-fit w-full">
      <Explore
        newContentData={newContent}
        updatedContentData={updatedContent}
        upcomingContentData={upcomingContent}
        loading={false}
      />
    </div>
  );
}
