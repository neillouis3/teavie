import React from "react";
import Link from "next/link";

export default function SmallCard() {

    return (
        <div className="w-full h-96 flex flex-col rounded-xl group ">
            
            <div className="w-full h-72 bg-gray-500 bg-opacity-50 rounded-xl relative">
            </div>


            <div className="flex flex-col rounded-b-xl  w-full h-[20%] group pt-2 gap-2">
                <div className="flex flex-row w-full gap-4 h-4"> 
                    <div className="flex-1 rounded-xl bg-opacity-50 bg-gray-500 w-full"></div>
                    <div className="flex-1 rounded-xl bg-opacity-50 bg-gray-500 w-full"></div>
                    <div className="flex-1 rounded-xl bg-opacity-50 bg-gray-500 w-full"></div>
                </div>
                <div className="bg-gray-500 bg-opacity-50 rounded-xl w-full h-4"></div>
            </div>

        </div>
    );
}