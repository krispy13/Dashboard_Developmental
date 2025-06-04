"use client";

import React from "react";
import ChoroplethMap from "@/components/choroplethMap";
import { Loader2 } from "lucide-react";

interface MapWrapperProps {
  className?: string;
  indices?: number[] | null;
  isLoading?: boolean;
  width?: number;
  height?: number;
  title?: string; // Add title prop
  colorScheme?: string; // Optional prop to style maps differently
  onCountyClick: (countyId: number) => void;
  activeGeomapData?: number[] | null;
  inactiveGeomapData?: number[] | null;
}

const MapWrapper: React.FC<MapWrapperProps> = ({
  className,
  indices,
  isLoading = false,
  width,
  height,
  colorScheme = "default",
  onCountyClick,
  activeGeomapData,
  inactiveGeomapData,
}) => {

  return (
    <div className="relative w-full lg:col-span-3">
      {/* Original Map Component */}
      <ChoroplethMap 
        className={className} 
        indices={indices || []}
        width={width}
        height={height}
        colorScheme={colorScheme}
        onCountyClick={onCountyClick}
        activeIndices={activeGeomapData || [] }
        inactiveIndices={inactiveGeomapData || []}
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md z-10">
          <div className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-md shadow-md flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Updating map...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapWrapper;