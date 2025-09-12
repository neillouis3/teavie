'use client'
import React from "react";
import SmallCardLoading from "../../ui/smallCardLoading";



export default function NewViewerLoading() { // Use the defined type for props

  return (
    <div className="w-full h-fit grid grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, index) => (
            <React.Fragment key={index}>
                <SmallCardLoading
// Placeholder poster path
                />
            </React.Fragment>
        ))}
    </div>
  );
}
