import React from "react";
import Link from "next/link";


export default function SideBar() {

 
    
    return (
        <div
            className="items-center bg-white z-40 flex flex-col fixed left-0 top-0 border-r border-gray-500 border-opacity-25 w-[15vw] h-screen py-2 px-4 "
        >
            <div className="w-full h-full my-2">
                <div
                    className="w-[75%]"
                >
                    <img src="/verLogo.png" alt="logo" className="" />
                </div>
                <div
                    className="flex flex-col text-ms gap-2 pl-2 mt-16"
                >
                    <div className="text-gray-500 hover:text-black">
                        <Link href="/explore" >
                            Explore
                        </Link>
                        
                    </div>
                    <div className="text-gray-500 hover:text-black">
                        <Link href="/movies/all">
                            Movies
                        </Link>
                    </div>
                    <div className="text-gray-500 hover:text-black">
                        <Link href="/shows/all">
                            TV Shows
                        </Link>
                    </div>

                </div>
                <div>
                    
                <div className="mt-96 text-xs items-center justify-center ">
                    <a className="">Support Us on Ko-Fi</a>
                    <div className="">ver. 1.0</div>
                </div>
                </div>
            </div>
            
        </div>
    );
}