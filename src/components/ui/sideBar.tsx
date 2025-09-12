"use client"
import React from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";


export default function SideBar() {

 
    
    return (
        <div
            className="items-center bg-white z-40 flex flex-col fixed left-0 top-0 w-[15vw] h-screen py-2 px-4 "
        >
            <div className="w-full h-full my-2">
                <div
                    className="w-[75%]"
                >
                    <img src="/verLogo.png" alt="logo" className="" />
                </div>
                <div
                    className="flex flex-col text-ms gap-2 pl-2 pr-2 mt-16"
                >

                    <div className="flex flex-col gap-4">
                        <div className="text-black hover:text-black">
                            <div className="bg-default-200 w-full px-4 py-2 rounded-sm ">
                                <Link href="/explore" >
                                    Explore
                                </Link>
                            </div>
                            
                            
                            
                            
                        </div>
                        <div className="text-gray-500 ml-4 hover:text-black">
                            <Link href="/movies/all">
                                Movies
                            </Link>
                        </div>
                        <div className="text-gray-500 ml-4 hover:text-black">
                            <Link href="/shows/all">
                                TV Shows
                            </Link>
                        </div>
                    </div>
                    <div className="mt-16 flex flex-col gap-4">
                        <div className="text-gray-500 ml-4 hover:text-black">
                            <Link href="/explore" >
                                History
                            </Link>
                            
                        </div>
                        <div className="text-gray-500 ml-4 hover:text-black">
                            <Link href="/movies/all">
                                Watch Later
                            </Link>
                        </div>
                        <div className="text-gray-500 ml-4 hover:text-black">
                            <Link href="/shows/all">
                                Liked Videos
                            </Link>
                        </div>
                        <div className="text-gray-500 ml-4 hover:text-black">
                            <Link href="/shows/all">
                                Random
                            </Link>
                        </div>
                    </div>
                    

                </div>
                
                    
                
            </div>
            
        </div>
    );
}