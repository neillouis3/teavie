'use client'
import React, {useEffect, useState} from "react";

import SmallCardLoading from "../../ui/smallCardLoading"
import SmallCard from "../../ui/smallCard";


const AllMovieViewer = () => {
    
    return (
        <div className="w-full h-full grid grid-cols-5 gap-4 pr-4">
            {Array.from({ length: 10 }).map((_, index) => (
                <React.Fragment key={index}>
                    <SmallCardLoading
// Placeholder poster path
                    />
                </React.Fragment>
            ))}
        </div>
    );
};

export default AllMovieViewer;
