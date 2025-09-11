'use client'

import React from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel"
import LargeCard from "../ui/largeCard";

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

// Define the props type for the UpcomingViewer component
interface UpcomingViewerProps {
    upcomingContentData: ContentItem[]; // Array of upcoming content items
}

export default function UpcomingViewer({ upcomingContentData }: UpcomingViewerProps) {

    const [api, setApi] = React.useState<CarouselApi>()
    const [current, setCurrent] = React.useState(0)
    const [count, setCount] = React.useState(0)
    
    React.useEffect(() => {
      if (!api) {
        return
      }
   
      setCount(api.scrollSnapList().length)
      setCurrent(api.selectedScrollSnap() + 1)
   
      api.on("select", () => {
        setCurrent(api.selectedScrollSnap() + 1)
      })
    }, [api])
   
    return (
        <div className="w-full flex flex-col items-center">
            <Carousel 
                opts={{
                    align: "center",
                    loop: true,
                }}
                className="w-full"
                setApi={setApi}
            >
                <CarouselContent className="-ml-4">
                    {upcomingContentData.map((item) => (
                        <CarouselItem key={item.id} className="pl-4 basis-2/3">
                            <LargeCard 
                                title={item.title}
                                date={item.release_year}
                                poster_path={item.poster_path}

                            />
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
            <div className="flex justify-center items-center space-x-2 mt-4">
                {Array.from({ length: count }).map((_, index) => (
                    <div
                        key={index}
                        className={`h-2 rounded-full transition-all duration-300 ${
                            index === current - 1
                                ? 'w-2 bg-gray-400'
                                : 'w-2 bg-gray-500'
                        }`}
                    />
                ))}
            </div>
        </div>
    )
}
