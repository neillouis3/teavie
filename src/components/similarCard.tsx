'use client'

import React from "react";
import Link from "next/link";

export default function SimilarCard ({title, year, type, runtime, seasonAmount, id, posterPath}:{title: string; year: number; type: string; runtime: number; seasonAmount?: number; id: number; posterPath: string}) {
    const baseUrl = 'https://image.tmdb.org/t/p/';
    const size = 'w500'; // Choose the size you want (e.g., w92, w185, w342, w500, w780, original)

    const imageUrl = `${baseUrl}${size}${posterPath}`;
    return (
        <Link href={type ==='show' ? `/shows/${id}`: `/movies/${id}`}>
        <div
            className="w-full h-18 bg-black bg-opacity-50 flex flex-row group rounded-lg "
        >
            
                <div
                    className="flex-1"
                >
                    <img src={imageUrl} alt="logo" className="w-full h-full object-cover rounded-l-lg" />
                </div>
                <div
                    className="flex-4 flex flex-col justify-center rounded-r-lg group-hover:bg-[#21D5E0] transition-colors duration-300 px-4 py-2"
                >
                    <h1 className="text-gray-500 group-hover:text-main text-xs">
                        {type === 'show' ? `TV Show / ${year} / SS ${seasonAmount} ` : `Movie / ${year} / ${runtime} min`}
                    </h1>
                    <h1
                        className="text-md group-hover:text-main "
                    >
                        {title}

                    </h1>

                </div>
            
            
            
        </div>
        </Link>
    );
}