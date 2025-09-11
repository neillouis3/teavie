'use client'

import React from "react";

export default function UpcomingViewerLoader() {
    return (
        <div className="w-full h-96 flex flex-col items-center mb-8">
            <div className="w-full h-full flex flex-row gap-4">
                <div className="flex-1 w-full h-full rounded-r-xl bg-gray-500 bg-opacity-50"></div>
                <div className="flex-5 w-full h-full rounded-xl bg-gray-500 bg-opacity-50"></div>
                <div className="flex-1 w-full h-full rounded-l-xl bg-gray-500 bg-opacity-50"></div>
            </div>
        </div>
    )
}
