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
    <div className="bg-background  w-full flex flex-col ">
      <Header pageName="Explore" />

      {/* New & Upcoming Section */}
      <div className="flex-col my-4 h-fit w-full">
        <div className="mb-4 pl-4">
          <Chip color="success" size="lg" radius="sm">
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
      <div className="flex flex-col lg:flex-row w-full h-fit mt-2 mb-8 px-4 gap-24">
        {/* New on SofaCouch */}
        <div className="flex-4 flex w-full flex-col">
          <div className="flex flex-row h-fit justify-between items-center">
            <Chip
              color="success"
              variant="flat"
              size="lg"
              className="mb-4"
              radius="sm"
            >
              New on SofaCouch
            </Chip>
            <a className="underline cursor-pointer text-sm hidden">View All</a>
          </div>
          <div className="w-full h-96">
            {loading ? (
              <NewViewerLoading />
            ) : (
              <NewViewer newContent={newContentData} />
            )}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="flex-2 flex h-fit flex-col pr-4 hidden lg:block">
          <Chip
            color="success"
            variant="flat"
            size="lg"
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
