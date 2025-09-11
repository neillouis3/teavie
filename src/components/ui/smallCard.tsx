import React from "react";
import Link from "next/link";

export default function SmallCard({id, title, year, runtime, seasonAmount, type, posterPath}: {id: number; title: string; year: number; runtime: number; seasonAmount: number; type: string; posterPath: string}) {
    const baseUrl = 'https://image.tmdb.org/t/p/';
    const size = 'w500'; // Choose the size you want (e.g., w92, w185, w342, w500, w780, original)

    const imageUrl = `${baseUrl}${size}${posterPath}`;
    const href = type === 'show' ? `/shows/${id}` : `/movies/${id}`; // Conditional href

    return (
        <div className="w-full h-96 flex flex-col rounded-xl group">
            <Link href={href}> {/* Updated href */}
            <div className="w-full flex-1 h-72 relative">
                <img 
                    src={imageUrl} 
                    alt="logo" 
                    className="w-full h-72 rounded-xl transition-all duration-300 group-hover:opacity-50" 
                />
                <div className="absolute w-full inset-0 bg-gradient-to-b from-transparent to-[#21D5E0] opacity-0 group-hover:opacity-50 transition-opacity duration-300 rounded-xl"></div>
                <div className="absolute w-full inset-0 flex items-center justify-center opacity-0 rounded-xl group-hover:opacity-100 transition-opacity duration-300 ">
                    <img src="/play.png" alt="Play" className="w-16 h-16 rounded-xl" />
                </div>
            </div>
            </Link>

            <div className="rounded-b-xl flex-1 text-gray-500 w-full h-[20%] group pt-2">
                <div className="flex flex-row justify-between items-center">
                    <p className="flex-1 text-xs text-start">{year}</p>
                    <div className="flex-1 text-xs text-center justify-center border border-gray-500 group-hover:border-[#21D5E0] rounded-2xl w-fit group-hover:text-[#21D5E0] transition-colors duration-300">
                        {type === 'show' ? 'TV' : type === 'movie' ? 'Movie' : type}
                    </div>
                    <p className="flex-1 text-xs text-end">
                        {type === 'show' ? `SS ${seasonAmount}` : type === 'movie' ? `${runtime} min` : ''}
                    </p>
                </div>
                <h1 className="text-s text-white group-hover:text-[#21D5E0] transition-colors duration-300">{title}</h1>
            </div>

        </div>
    );
}