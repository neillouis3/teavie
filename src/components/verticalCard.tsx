'use client'

import React from "react";
import GenreItem from "./ui/genreItem";

export default function SimilarCard ({title, year}:{title: string; year: number; }) {
    return (
        <div
            className="w-full bg-black bg-opacity-50 flex flex-row rounded-lg "
        >
            <div
                className="flex-1"
            >
                <img src="/deadpool.jpeg" alt="logo" className="w-full h-fit rounded-l-lg" />
            </div>
            <div
                className="flex-5 flex flex-col justify-center rounded-r-lg hover:text-main hover:bg-[#21D5E0] transition-colors duration-300 px-4 py-2"
            >
                <h1 className="text-gray-500 text-xs">TV / {year} / 130 min</h1>
                <h1
                    className="text-md  "
                >
                    {title}
                </h1>

            </div>
            
        </div>
    );
}