'use client';

import React, { useState, useEffect } from "react";
import Explore from "@/components/explore";
import { ContentItem } from "@/types/content";

export default function DiscoverPage() {
  const [newContent, setNewContent] = useState<ContentItem[]>([]);
  const [updatedContent, setUpdatedContent] = useState<ContentItem[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Discover - Teavie";
  }, []);

  useEffect(() => {
    const fetchDiscoverData = async () => {
      try {
        const [newRes, updatedRes, upcomingRes] = await Promise.all([
          fetch("/api/new"),
          fetch("/api/updated"),
          fetch("/api/upcoming?type=movie"),
        ]);

        if (!newRes.ok || !updatedRes.ok || !upcomingRes.ok) {
          throw new Error("Error fetching discover data");
        }

        const [newData, updatedData, upcomingData] = await Promise.all([
          newRes.json(),
          updatedRes.json(),
          upcomingRes.json(),
        ]);

        setNewContent(newData.results ?? []);
        setUpdatedContent(updatedData.results ?? []);
        setUpcomingContent(upcomingData.results ?? []);
      } catch (error) {
        console.error("Error fetching discover data:", error);
        setNewContent([]);
        setUpdatedContent([]);
        setUpcomingContent([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoverData();
  }, []);

  return (
    <div className="h-fit w-full">
      <Explore
        newContentData={newContent}
        updatedContentData={updatedContent}
        upcomingContentData={upcomingContent}
        loading={loading}
      />
    </div>
  );
}
