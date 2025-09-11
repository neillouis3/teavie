import React from "react";
import Link from "next/link";


export default function SideBar() {

 
    
    return (
        <div
            className="flex flex-col border-r border-gray-500 border-opacity-25 w-full h-full py-2 px-4 text-white"
        >
            <div
                className="flex justify-center py-4"
            >
                <img src="/horLogo.png" alt="logo" className="w-[100%] h-fit" />
            </div>
            <div
                className="flex flex-col text-ms gap-2 pl-4 mt-16"
            >
                <div className="text-gray-500 hover:text-white">
                    <Link href="/explore" >
                        Explore
                    </Link>
                    
                </div>
                <div className="text-gray-500 hover:text-white">
                    <Link href="/movies/all">
                        Movies
                    </Link>
                </div>
                <div className="text-gray-500 hover:text-white">
                    <Link href="/shows/all">
                        TV Shows
                    </Link>
                </div>

            </div>
            <div>
                
            <div className="mt-96 text-xs flex flex-col items-center justify-center ">
                <a className="text-theme">Support Us on Ko-Fi</a>
                <div className="text-gray-500">ver. 1.0</div>
            </div>
            </div>
        </div>
    );
}