'use client';
import React, { useState, useEffect } from "react";
import Explore, { type TmdbDiscoverPayload } from "@/components/explore";
import { ContentItem } from "@/types/content";

const EMPTY_DISCOVER: TmdbDiscoverPayload = {
  trendingMovies: [],
  trendingTv: [],
  popularMovies: [],
  popularTv: [],
};

export default function ExplorePage() {
  const [newContent, setNewContent] = useState<ContentItem[]>([]);
  const [updatedContent, setUpdatedContent] = useState<ContentItem[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tmdbDiscover, setTmdbDiscover] = useState<TmdbDiscoverPayload | null>(null);
  const [tmdbDiscoverLoading, setTmdbDiscoverLoading] = useState(true);

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    const fetchExploreData = async () => {
      try {
        const [newRes, updatedRes, upcomingRes] = await Promise.all([
          fetch("/api/new"),
          fetch("/api/updated"),
          fetch("/api/upcoming"),
        ]);

        if (!newRes.ok || !updatedRes.ok || !upcomingRes.ok) {
          throw new Error("Error fetching explore data");
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
        console.error("Error fetching explore data:", error);
        setNewContent([]);
        setUpdatedContent([]);
        setUpcomingContent([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExploreData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTmdbDiscoverLoading(true);

    fetch("/api/tmdb/discover")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTmdbDiscover({
          trendingMovies: data.trendingMovies ?? [],
          trendingTv: data.trendingTv ?? [],
          popularMovies: data.popularMovies ?? [],
          popularTv: data.popularTv ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setTmdbDiscover(EMPTY_DISCOVER);
      })
      .finally(() => {
        if (!cancelled) setTmdbDiscoverLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full h-fit">
      <Explore
        newContentData={newContent}
        updatedContentData={updatedContent}
        upcomingContentData={upcomingContent}
        loading={loading}
        tmdbDiscover={tmdbDiscover}
        tmdbDiscoverLoading={tmdbDiscoverLoading}
      />
    </div>
  );
}
