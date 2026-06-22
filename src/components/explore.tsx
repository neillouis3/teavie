import React from "react";
import Header from "./ui/header";
import UpcomingViewer from "./viewer/upcomingViewer";
import NewViewer from "./viewer/newViewer";
import UpdatedViewer from "./viewer/updatedViewer";

import UpcomingViewerLoading from "./viewer/skeleton/upcomingViewerLoading";
import NewViewerLoading from "./viewer/skeleton/newViewerLoading";
import UpdatedViewerLoading from "./viewer/skeleton/updatedViewerLoading";

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

      {/* New + Updated Section */}
      <div className="mb-8 mt-2 flex h-fit w-full flex-col gap-8 px-3 sm:px-4 lg:flex-row lg:gap-16 xl:gap-24">
        {/* New on SofaCouch */}
        <div className="flex-4 flex w-full flex-col">
          <div className="flex flex-row h-fit justify-between items-center">
            <Chip
              color="success"
              variant="flat"
              size="md"
              className="mb-4"
              radius="sm"
            >
              New on SofaCouch
            </Chip>
            <a className="underline cursor-pointer text-sm hidden">View All</a>
          </div>
          <div className="w-full">
            {loading ? (
              <NewViewerLoading />
            ) : (
              <NewViewer newContent={newContentData} />
            )}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="flex-2 hidden h-fit flex-col md:block lg:pr-4">
          <Chip
            color="success"
            variant="flat"
            size="md"
            className="mb-4"
            radius="sm"
          >
            Recently Updated
          </Chip>
          <div className="w-full h-fit rounded-xl">
            {loading ? (
              <UpdatedViewerLoading />
            ) : (
              <UpdatedViewer updatedContent={updatedContentData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
