'use client';

import React from 'react';

const similarViewerLoading = () => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 10 }).map((_, index) => (
          <React.Fragment key={index}>
              <div className='w-full h-18 rounded-lg bg-gray-500'>

              </div>
          </React.Fragment>
      ))}
    </div>
  );
};

export default similarViewerLoading;
