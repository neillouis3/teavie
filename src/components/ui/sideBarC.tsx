import React, { useState } from "react";

export default function SideBar() {
  // State to track sidebar visibility
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Function to toggle the sidebar visibility
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Menu Icon to toggle sidebar */}
      <div
        className="absolute top-4 left-4 cursor-pointer z-50"
        onClick={toggleSidebar}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-menu text-white"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </div>

      {/* Overlay effect when sidebar is open */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={toggleSidebar}
      ></div>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-gray-800 border-r border-gray-500 border-opacity-25 z-50 transition-transform duration-300 transform ${
          isCollapsed ? "-translate-x-full" : "translate-x-0"
        } w-64 flex flex-col py-2 text-white`}
      >
        <div className="flex justify-center">
          <img src="/textLogo.png" alt="logo" className="w-fit h-20" />
        </div>
        <div className="flex flex-col gap-2 ml-16 mt-16">
          <div>
            <a href="#">Explore</a>
          </div>
          <div>
            <a href="#">Movies</a>
          </div>
          <div>
            <a href="#">TV Shows</a>
          </div>
        </div>
      </div>
    </>
  );
}
