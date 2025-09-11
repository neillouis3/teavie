import React from 'react';

export default function EpisodesViewer ({ amount = 5 }) { // Set default amount to 5
    return (
        <div
            className="flex flex-row flex-wrap gap-2"
        >
            {Array.from({ length: amount }).map((_, index) => (
                <div
                    key={index}
                    className="rounded-lg bg-gray-500 bg-opacity-50 w-10 h-8 flex justify-center items-center"
                >
                    <p className="text-white">{index + 1}</p>
                </div>
            ))}
        </div>
    )
}