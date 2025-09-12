'use client'
import Explore from "@/components/explore";
import React, { useState, useEffect } from 'react';

// Constant function to fetch explore data
// const fetchExploreData = async () => {
//   try {
//     const response = await fetch('/api/fetchExploreData');
//     if (!response.ok) {
//       throw new Error('Error fetching data');
//     }
//     const data = await response.json();
//     return data;
//   } catch (error) {
//     console.error('Error fetching explore data:', error);
//     return { new_content: [], updated_content: [], upcoming_content: [] };
//   }
// };

export default function ExplorePage() {
  // const [newContent, setNewContent] = useState([]);
  // const [updatedContent, setUpdatedContent] = useState([]);
  // const [upcomingContent, setUpcomingContent] = useState([]);
  // const [loading, setLoading] = useState(true); // Add loading state

  // useEffect(() => {
  //   const getExploreData = async () => {
  //     const data = await fetchExploreData();
  //     setNewContent(data.new_content);
  //     setUpdatedContent(data.updated_content);
  //     setUpcomingContent(data.upcoming_content);
  //     setLoading(false); // Set loading to false once data is fetched
  //   };

  //   getExploreData();
  // }, []);

  return (
    // Pass the loading state to the Explore component along with the content data
    // <Explore 
    //   upcomingContentData={upcomingContent} 
    //   newContentData={newContent} 
    //   updatedContentData={updatedContent}
    //   loading={loading} // Pass loading prop
    // />
    
    <div className="w-full h-fit">
      <Explore/>
    </div>
  );
}
