'use client'
import React from "react";
import SmallCardLoading from "../../ui/smallCardLoading";



export default function NewViewerLoading() { // Use the defined type for props

  return (
    <div className="w-full h-full grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
            <React.Fragment key={index}>
                <SmallCardLoading
// Placeholder poster path
                />
            </React.Fragment>
        ))}
    </div>
  );
}
