import React from "react";
import Header from "./ui/header";
import UpcomingViewer from "./viewer/upcomingViewer";
import CatalogRail from "./explore/catalogRail";

import UpcomingViewerLoading from "./viewer/skeleton/upcomingViewerLoading";

import { Chip } from "@heroui/react";
import { ContentItem } from "@/types/content";

interface ExploreProps {
  newContentData: ContentItem[];
  updatedContentData: ContentItem[];
  upcomingContentData: ContentItem[];
  loading: boolean;
}

export default function Explore({
  newContentData,
  updatedContentData,
  upcomingContentData,
  loading,
}: ExploreProps) {
  return (
    <div className="flex w-full flex-col bg-background/92 dark:bg-background/88">
      <Header pageName="Discover" />

      {/* New & Upcoming Section */}
      <div className="mt-6 mb-4 flex h-fit w-full flex-col">
        <div className="mb-4 px-3 sm:pl-4">
          <Chip color="success" size="md" radius="sm">
            New & Upcoming
          </Chip>
        </div>
        <div>
          {loading ? (
            <UpcomingViewerLoading />
          ) : (
            <UpcomingViewer upcomingContentData={upcomingContentData} />
          )}
        </div>
      </div>

      {/* New + Updated */}
      <div className="mb-8 mt-2 flex h-fit w-full flex-col gap-10 px-3 sm:px-4">
        <CatalogRail
          title="New on Teavie"
          items={newContentData}
          showReleaseNote
          loading={loading}
        />
        <CatalogRail
          title="Recently Updated"
          items={updatedContentData}
          loading={loading}
        />
      </div>
    </div>
  );
}
