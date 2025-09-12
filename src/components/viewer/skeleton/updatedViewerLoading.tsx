'use client';

import React from 'react';

const UpdatedViewerLoading = () => {
  return (
    <div className="flex h-fit flex-col gap-2">
      {Array.from({ length: 10 }).map((_, index) => (
          <React.Fragment key={index}>
              <div className='w-full h-18 rounded-lg bg-gray-500 bg-opacity-50'>

              </div>
          </React.Fragment>
      ))}
    </div>
  );
};

export default UpdatedViewerLoading;
