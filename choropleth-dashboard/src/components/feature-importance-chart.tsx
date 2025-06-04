"use client"

import React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  type TooltipProps,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import { ChartContainer } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomTooltipProps extends TooltipProps<number, string> {}

// Define histogram data structure
interface ColumnHistogram {
  counts: number[];
  bin_edges: number[];
}

interface FeatureImportanceProps {
  featureData: {
    features: string[];
    importance: number[];
  } | null;
  columnHistograms?: {
    [key: string]: ColumnHistogram;
  } | null;
  fullColumnHistograms?: {
    [key: string]: ColumnHistogram;
  } | null;
  isLoading: boolean;
  className?: string;
}

const FeatureImportanceChart: React.FC<FeatureImportanceProps> = ({
  featureData,
  columnHistograms,
  fullColumnHistograms,
  isLoading,
  className,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeFeature, setActiveFeature] = React.useState<string | null>(null);
  const [useLogScale, setUseLogScale] = React.useState<boolean>(true);

  const barFillColor = "hsla(217, 91%, 60%, 0.6)";
  const barStrokeColor = "hsla(217, 91%, 60%, 1)";
  // Change the filtered data colors to a more vibrant orange
  const histogramStrokeColor = "hsla(25, 95%, 50%, 1)";
  // Change the full dataset color to blue
  const fullHistogramStrokeColor = "hsla(217, 91%, 50%, 1)";
  // Change active color to a more visible green
  const activeColor = "hsla(25, 95%, 60%, 0.7)";

  const formatFeatureName = (name: string): string => {
    // Replace hyphens with spaces
    return name.replace(/-/g, ' ');
  };

  // Prepare data for the horizontal bar chart
  const prepareData = () => {
    if (!featureData || !featureData.features.length) return [];
    
    return featureData.features
      .map((feature, index) => ({
        name: feature,
        importance: featureData.importance[index],
        // Add negative importance for left-extending bars
        negativeImportance: -featureData.importance[index],
      }))
      .sort((a, b) => b.importance - a.importance); // Sort by importance
  };

  // Apply logarithmic scaling to histogram counts to improve visibility of small values
  const applyLogScaling = (count: number): number => {
    // Use log scaling with a minimum threshold to ensure visibility
    const minVisibleHeight = 0.2; // Minimum height as a proportion of max value
    const logBase = 10;
    
    if (count <= 0) return 0;
    
    // Apply log scaling: log(count + 1) to handle zero values
    // Scale up by log(maxFrequency + 1) to normalize
    const logScaled = Math.log(count + 1) / Math.log(logBase);
    
    // Ensure a minimum visible height for non-zero values
    return count > 0 ? Math.max(logScaled, minVisibleHeight) : 0;
  };

  // Transform raw histogram data to Recharts format with improved scaling
  const prepareHistogramData = (feature: string) => {
    const histogram = columnHistograms?.[feature];
    const fullHistogram = fullColumnHistograms?.[feature];
    
    // If neither histogram exists, return empty array
    if (!histogram) return [];
    
    // We can now assume that bin edges are identical between histogram and fullHistogram
    return histogram.counts.map((filteredCount, i) => {
      const binStart = histogram.bin_edges[i].toFixed(2);
      const binEnd = histogram.bin_edges[i + 1].toFixed(2);
      const binLabel = `${binStart}-${binEnd}`;
      
      // Get full dataset count for the same bin
      const fullCount = fullHistogram?.counts[i] || 0;
      
      return {
        bin: binLabel,
        frequency: filteredCount,
        scaledFrequency: useLogScale ? applyLogScaling(filteredCount) : filteredCount,
        fullFrequency: fullCount,
        scaledFullFrequency: useLogScale ? applyLogScaling(fullCount) : fullCount
      };
    });
  };

  const chartData = prepareData();

  const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const featureName = payload[0].payload.name;
      
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
          <div className="flex flex-col">
            <p className="font-medium mb-1">{`Feature: ${featureName}`}</p>
            <span className="mb-1">Importance: {Math.abs(payload[0].value as number).toFixed(4)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomHistogramTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const frequency = payload[0].payload.frequency;
      const fullfrequecy = payload[1].payload.fullFrequency;
      const bin = payload[0].payload.bin;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
          <div key="Bin" className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              RANGE
            </span>
            <span className="font-bold">{bin}</span>
          </div>
          {payload.map((p) => (
              <div key={p.name} className="flex flex-col">
                <span className="text-[0.70rem] uppercase text-muted-foreground">
                  {p.name === "scaledFrequency" ? "Subset Frequency" : "Dataset Frequency"}
                </span>
                {p.name === "scaledFrequency" ? (
                  <span className="font-bold">{Math.abs(frequency ?? 0)}</span>
                ) : (
                  <span className="font-bold">{Math.abs(fullfrequecy ?? 0)}</span>
                )}
              </div>
            ))}
        </div>
        
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading data...</span>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No feature importance data available
      </div>
    );
  }

  // Define row height - Increase this value to make rows bigger
  const rowHeight = 120; // Changed from 60px to 100px
  
  return (
    <div className={className}>
      <div className="h-[100vh] overflow-y-auto pr-2">
        <div className="absolute top-[-15px] right-16 flex space-x-1 z-10">
          <Button 
            size="sm"
            variant={"default"} 
            onClick={() => setUseLogScale(!useLogScale)}
            className="text-xs py-1 h-8"
          >
            {useLogScale ? "Use Linear Scale" : "Use Log Scale"}
          </Button>
        </div>
        <ChartContainer
          className="min-h-[33vh] w-full"
          config={{
            bar: {
              label: "Bar Chart",
              icon: undefined,
              theme: {
                light: "light-theme-class",
                dark: "dark-theme-class",
              },
            },
          }}
        >
          <div className="grid grid-cols-12 h-full gap-1">
            {/* Left side - Bar Chart */}
            <div className="col-span-3">
              <ResponsiveContainer width="100%" height={(chartData.length * rowHeight) + 20}>
                <BarChart 
                  layout="vertical" 
                  data={chartData} 
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  barCategoryGap={'10%'}
                  barSize={60}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "#555" : "#ddd"} />
                  <XAxis
                    type="number"
                    domain={[0, 'auto']}
                    tickFormatter={(value) => Math.abs(value).toFixed(3)}
                    tick={{ fill: isDark ? "#ccc" : "#333" }}
                    orientation="top"
                    reversed={true}
                    height={20}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={0} 
                    tick={false} 
                    axisLine={false} 
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="importance"
                    fill={barFillColor}
                    stroke={barStrokeColor}
                    strokeWidth={1}
                    animationDuration={1000}
                    radius={[4, 0, 0, 4]}
                    onMouseEnter={(data) => setActiveFeature(data.name ?? null)}
                    onMouseLeave={() => setActiveFeature(null)}
                  >
                    {chartData.map((entry, index) => (
                      <Bar
                        key={`bar-${index}`}
                        dataKey="importance"
                        fill={entry.name === activeFeature ? activeColor : barFillColor}
                        stroke={entry.name === activeFeature ? activeColor : barStrokeColor}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Center - Feature Names */}
            <div className="col-span-2 mt-[20px]">
              <div className="grid h-full" style={{ gridTemplateRows: `repeat(${chartData.length}, ${rowHeight}px)` }}>
                {chartData.map((item, index) => (
                  <div
                    key={`feature-${index}`}
                    className="flex items-center justify-center cursor-pointer truncate w-full h-full"
                    onMouseEnter={() => setActiveFeature(item.name)}
                    onMouseLeave={() => setActiveFeature(null)}
                  >
                    <span 
                      className="text-xs font-medium px-1 text-wrap w-full text-center"
                      style={{
                        color: item.name === activeFeature ? (isDark ? "#ffffff" : "#000000") : isDark ? "#ccc" : "#333",
                        fontWeight: item.name === activeFeature ? "bold" : "normal",
                      }}
                      title={item.name}
                    >
                      {formatFeatureName(item.name)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side - Histograms */}
            <div className="col-span-7 mt-[20px]">
              <div style={{ height: `${chartData.length * rowHeight}px` }}>
                {chartData.map((item, index) => {
                  const histogramData = prepareHistogramData(item.name);
                  
                  return (
                    <div
                      key={`histogram-${index}`}
                      className="w-full"
                      style={{ height: `${rowHeight}px` }} // Explicit height setting
                      onMouseEnter={() => setActiveFeature(item.name)}
                      onMouseLeave={() => setActiveFeature(null)}
                    >
                      {histogramData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart 
                            data={histogramData} 
                            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="2%" stopColor="hsla(217, 91%, 50%, 0.7)" stopOpacity={1}/>
                                <stop offset="99%" stopColor="hsla(217, 91%, 50%, 0.7)" stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="2%" stopColor="hsla(25, 95%, 50%, 0.7)" stopOpacity={1}/>
                                <stop offset="99%" stopColor="hsla(25, 95%, 50%, 0.7)" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid 
                              strokeDasharray="3 3" 
                              vertical={false} 
                              opacity={0.9}
                              stroke={isDark ? "#555" : "#ddd"} 
                            />
                            <XAxis 
                              dataKey="bin" 
                              tick={{ fontSize: 10, fill: isDark ? "#ccc" : "#333" }}
                              tickLine={false}
                              axisLine={false}
                              interval={2}
                              height={20}
                            />
                            <YAxis 
                              domain={useLogScale ? [0, 1.1] : [0, 'auto']} // Conditional domain based on scale
                              hide 
                            />
                            <Tooltip content={<CustomHistogramTooltip />} />
                            <Area
                              type="step"
                              dataKey="scaledFullFrequency"
                              fill="url(#colorUv)"
                              stroke={fullHistogramStrokeColor}
                              strokeWidth={1}
                            />
                            <Area
                              type="step"
                              dataKey="scaledFrequency"
                              fill="url(#colorPv)"
                              stroke={item.name === activeFeature ? activeColor : histogramStrokeColor}
                              strokeWidth={1}
                            />
                            
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                          No histogram data
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ChartContainer>
      </div>
    </div>
  );
};

export default FeatureImportanceChart;