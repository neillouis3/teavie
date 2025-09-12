import React from "react";
import Header from "./ui/header";
// import UpcomingViewer from "./viewer/upcomingViewer";
// import NewViewer from "./viewer/newViewer";
// import UpdatedViewer from "./viewer/updatedViewer";
import UpcomingViewerLoading from "./viewer/skeleton/upcomingViewerLoading";
import NewViewerLoading from "./viewer/skeleton/newViewerLoading";
import UpdatedViewerLoading from "./viewer/skeleton/updatedViewerLoading";
import { Chip } from "@heroui/react";
// Define the type for each content item
type ContentItem = {
  id: number;
  title: string;
  release_year: number;
  type: string;
  runtime: number;
  season_amount: number;
  poster_path: string;
};

// Define the props type for the Explore component
interface ExploreProps {
  newContentData: ContentItem[]; // Array of new content items
  updatedContentData: ContentItem[];
  upcomingContentData: ContentItem[]; // Array of updated content items
  loading: boolean; // Add loading state prop
}

// export default function Explore({
//   newContentData,
//   updatedContentData,
//   upcomingContentData,
//   loading, // Receive the loading state
// }: ExploreProps): JSX.Element {
//   return (
//     <div className="bg-main h-fit w-full flex flex-col">
//       <Header pageName="Explore" />
//       <div className="flex-col my-4 w-full">
//         <h1 className="text-white mb-2 pl-4">New & Upcoming</h1>
//         <div>
//             {loading ? (<UpcomingViewerLoading />) : (<UpcomingViewer upcomingContentData={upcomingContentData} />)}
          
//         </div>
//       </div>
//       <div className="flex flex-row w-full text-white mt-2 px-4 gap-32">
//         <div className="flex-4 flex w-full flex-col">
//           <div className="flex flex-row justify-between items-center">
//             <h1 className="mb-2">New on SofaCouch</h1>
//             <div className="h-full flex items-center justify-center">
//               <a className="underline">View All</a>
//             </div>
//           </div>
//           <div className="w-full h-96">
//             {loading ? (<NewViewerLoading />) : (<NewViewer newContent={newContentData} />)}
            
//           </div>
//         </div>
//         <div className="flex-2 flex flex-col">
//           <h1 className="mb-2">Recently Updated</h1>
//           <div className="w-full h-96 rounded-xl">
//             {loading ? (<UpdatedViewerLoading />) : (<UpdatedViewer updatedContent={updatedContentData} />)}
            
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


export default function Explore(){
  return (
    <div className="bg-[#F3F4F6] h-full w-full flex flex-col mb-128">
      <Header pageName="Explore" />
      <div className="flex-col my-4 h-fit w-full">
        <div className="mb-2 pl-4">
          <Chip color="success" size="md">New & Upcoming</Chip>
        </div>
        <div>
            <UpcomingViewerLoading />
          
          
        </div>
      </div>
      <div className="flex flex-row w-full h-fit mt-2 px-4 gap-32">
        <div className="flex-4 flex w-full flex-col">
          <div className="flex flex-row h-fit justify-between items-center">
            <Chip color="success" variant="flat" size="md" className="mb-2">New on SofaCouch</Chip>
            
            <div className="h-full flex items-center justify-center">
              <a className="underline">View All</a>
            </div>
          </div>
          <div className="w-full h-96">
            <NewViewerLoading />
            
          </div>
        </div>
        <div className="flex-2 flex h-fit flex-col">
        <Chip color="success" variant="flat" size="md" className="mb-2">Recently Updated</Chip>
          <div className="w-full h-96 rounded-xl">
            <UpdatedViewerLoading />
            
          </div>
        </div>
      </div>
    </div>
  );
}
