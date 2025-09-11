import { div } from "framer-motion/client";
import React from "react";

export default function PosterCard ({title}:{title: string;}) {
    return (
        <div
            className="w-full flex flex-col rounded-lg gap-2 relative"
        >
            <div
                className="flex-1"
            >
                <img src="/deadpool.jpeg" alt="logo" className="w-full h-1/2 rounded-lg" />
                <h1 className="absolute top-0 left-0 text-xl font-medium text-white">
                    {title}
                </h1>
            </div>

            
        </div>
    )
}