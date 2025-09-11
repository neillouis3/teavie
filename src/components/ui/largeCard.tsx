import React from "react";

export default function LargeCard({title, date, poster_path}:{title:string; date:number; poster_path:string}) {
    const baseUrl = 'https://image.tmdb.org/t/p/';
    const size = 'original'; // Choose the size you want (e.g., w92, w185, w342, w500, w780, original)

    const imageUrl = `${baseUrl}${size}${poster_path}`;
    return (
        <div className=" w-full rounded-xl relative ">
            <img src={imageUrl} alt="logo" className="w-full h-full rounded-xl object-cover" />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black rounded-xl"></div>
            
            <div className="w-full rounded-b-xl  h-40 absolute bottom-0 w-[calc(100%-1rem)] py-4 px-8">
                <h1 className="text-3xl font-black text-white break-words w-[75%]">{title}</h1>
                <p className="text-white opacity-50">Coming Soon This {date}</p>
            </div>
        </div>
    );
}
