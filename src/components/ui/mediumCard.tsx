import React from "react";
import GenreItem from "./genreItem";

export default function MediumCard() {
    return (
        <div
            className="w-full h-full flex flex-col rounded-xl relative group"
        >
            <div>
                <img src="./fallguy.jpg" alt="" className="w-full h-full rounded-xl"/>
            </div>
            
            <div className="w-full h-[30%] rounded-b-xl absolute bottom-0 left-0  px-2 py-1  backdrop-blur-md bg-gray-500 bg-opacity-30">
                <h1 className="text-lg font-bold text-white">The Instigators</h1>
                <p className="-mt-1">2022</p>
                <GenreItem genre={"Action"}/>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 rounded-xl group-hover:opacity-100 transition-opacity duration-300 bg-black bg-opacity-50">
                <img src="/play.png" alt="Play" className="w-16 h-16 rouded-xl" />
            </div>
            
        </div>
    );
}