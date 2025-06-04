"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import DataTable from "./data-table"
import { Loader2, BarChart2 } from "lucide-react"


// Define the type for selected options
interface SelectedOptions {
  pattern: number
  law: string
}

// Define the props interface
interface HistogramChartProps {
  selectedOptions: SelectedOptions
  histData: HistogramAPIResponse | null
  stateData: string[] | null
  countyData: string[] | null
  isLoading: boolean
  currentLaw?: string 
  activeHighlightedValue?: number | null
  inactiveHighlightedValue?: number | null
}

// Define the number of bins
const NUM_BINS = 40

// Interface for each bin after processing
interface HistogramBin {
  range: string
  lawInactive: number
  lawActive: number
  isHighlightedActive?: boolean
  isHighlightedInactive?: boolean
}

// Interface for the raw API response
interface HistogramAPIResponse {
  cleaned_conds: string[]
  histogram_data: [number[], number[]]
  ite_scores: [number, number]
  test_scores: [number, number, number, number, number]
}

// Interface for Statistical Information
export interface StatisticalInfo {
  inactiveMean: number
  activeMean: number
  pairedTPValue: number
  mannWhitneyPValue: number
  avgITE: number
  stdevITE: number
  imbalanceRatio: number
  cohensD: number
}

// Props for the Tooltip content
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomTooltipProps extends TooltipProps<number, string> {}

// Binning function
const binData = (
  inactive: number[],
  active: number[],
  numBins: number,
  useNegativeInactive: boolean = false,
  activeHighlightedValue: number | null = null,
  inactiveHighlightedValue: number | null = null
): { bins: HistogramBin[]; min: number; max: number } => {
  const allData = [...inactive, ...active]
  const min = Math.min(...allData)
  const max = Math.max(...allData)

  const binWidth = (max - min) / numBins
  const bins: Array<{
    rangeStart: number
    rangeEnd: number
    lawInactive: number
    lawActive: number
    isHighlightedActive: boolean
    isHighlightedInactive: boolean
  }> = Array.from({ length: numBins }, (_, i) => ({
    rangeStart: min + i * binWidth,
    rangeEnd: min + (i + 1) * binWidth,
    lawInactive: 0,
    lawActive: 0,
    isHighlightedActive: false,
    isHighlightedInactive: false
  }))

  inactive.forEach((value) => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1)
    bins[binIndex].lawInactive += useNegativeInactive ? -1 : 1
  })

  active.forEach((value) => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1)
    bins[binIndex].lawActive += 1
  })

  if (activeHighlightedValue) {
    const binIndex = Math.min(Math.floor((activeHighlightedValue - min) / binWidth), numBins - 1)
    bins[binIndex].isHighlightedActive = true
  }

  if (inactiveHighlightedValue) {
    const binIndex = Math.min(Math.floor((inactiveHighlightedValue - min) / binWidth), numBins - 1)
    bins[binIndex].isHighlightedInactive = true
  }

  // If we're using negative values for inactive, we need to adjust the min value for charting
  const chartMin = min
  const chartMax = max

  const formattedBins = bins.map((bin) => ({
    range: `${bin.rangeStart.toFixed(2)} - ${bin.rangeEnd.toFixed(2)}`,
    lawInactive: bin.lawInactive,
    lawActive: bin.lawActive,
    isHighlightedActive: bin.isHighlightedActive,  // Preserve this
    isHighlightedInactive: bin.isHighlightedInactive,  // Preserve this
    rangeStart: bin.rangeStart,  // Keep this for reference
    rangeEnd: bin.rangeEnd,  // Keep this for reference
  }))

  return { bins: formattedBins, min: chartMin, max: chartMax }
}

// Helper function to calculate mean
const calculateMean = (data: number[]): number => {
  if (data.length === 0) return 0
  const sum = data.reduce((acc, val) => acc + val, 0)
  return sum / data.length
}

const HistogramChart: React.FC<HistogramChartProps> = ({ selectedOptions, histData, stateData, countyData, isLoading, currentLaw, activeHighlightedValue, inactiveHighlightedValue }) => {
  const { law } = selectedOptions

  // State for histogram data
  const [histogramData, setHistogramData] = useState<HistogramBin[]>([])
  // State for statistical information
  const [statInfo, setStatInfo] = useState<StatisticalInfo | null>(null)
  // State for min and max values
  const [minValue, setMinValue] = useState<number>(0)
  const [maxValue, setMaxValue] = useState<number>(0)
  // State to show/hide the table
  const [showTable, setShowTable] = useState(false)
  // State to toggle negative inactive values
  const [negativeInactive, setNegativeInactive] = useState(false)

  // Process histogram_data from the API response with binning
  const processHistogramData = (
    histogramData: [number[], number[]],
  ): { bins: HistogramBin[]; min: number; max: number } => {
    const [inactive, active] = histogramData // histogram_data is a tuple of two arrays
    return binData(inactive, active, NUM_BINS, negativeInactive, activeHighlightedValue, inactiveHighlightedValue)
  }

  // USER SET PATTERN
  useEffect(() => {

    console.log("Histogram updating with highlighted values:", {
      activeHighlightedValue,
      inactiveHighlightedValue
    });

    if (histData) {
      const processedData = processHistogramData(histData.histogram_data)
      setHistogramData(processedData.bins)
      setMinValue(processedData.min)
      setMaxValue(processedData.max)

      // Calculate statistical information
      const inactiveMean = calculateMean(histData.histogram_data[0])
      const activeMean = calculateMean(histData.histogram_data[1])

      // Extract test scores and ITE values
      const mannWhitneyPValue = histData.test_scores[0]
      const pairedTPValue = histData.test_scores[1]
      const imbalanceRatio =histData.test_scores[3]
      const cohensD = histData.test_scores[4]

      // Create statInfo object
      const newStatInfo: StatisticalInfo = {
        inactiveMean,
        activeMean,
        pairedTPValue,
        mannWhitneyPValue,
        avgITE: histData.ite_scores[0],
        stdevITE: histData.ite_scores[1],
        imbalanceRatio,
        cohensD
      }

      // Update local state
      setStatInfo(newStatInfo)
    }
  }, [histData, negativeInactive, activeHighlightedValue, inactiveHighlightedValue])

  // Custom Tooltip Component
  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">Range</span>
              <span className="font-bold">{payload[0].payload.range}</span>
            </div>
            {payload.map((p) => (
              <div key={p.name} className="flex flex-col">
                <span className="text-[0.70rem] uppercase text-muted-foreground">
                  {p.name === "lawActive" ? "Law Active" : "Law Inactive"}
                </span>
                <span className="font-bold">{Math.abs(p.value ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  const toggleView = () => {
    setShowTable(!showTable)
  }

  const toggleNegativeInactive = () => {
    setNegativeInactive(!negativeInactive)
    // Reprocessing is handled by the useEffect that watches negativeInactive
  }

  // Format the mean value to 3 decimal places
  const formatMean = (value: number | undefined) => {
    if (value === undefined) return "N/A"
    return value.toFixed(3)
  }

  // Function to find county data based on active/inactive values
  const findCountyByValues = (
    countyNames: string[] | null,
    stateNames: string[] | null,
    histData: HistogramAPIResponse | null,
    activeValue: number | null | undefined,
    inactiveValue: number | null | undefined
  ) => {
    if (!countyNames || !stateNames || !histData) return null;

    const result: {
      selectedCounty?: { 
        county: string; 
        state: string; 
        activeValue: number | null;
        inactiveValue: number | null;
        index: number;
      };
    } = {};

    // Get the active and inactive data arrays
    const activeData = histData.histogram_data[1];
    const inactiveData = histData.histogram_data[0];
    
    // Find counties that match our criteria
    for (let i = 0; i < countyNames.length; i++) {
      const currentActiveValue = activeData[i];
      const currentInactiveValue = inactiveData[i];
      
      // If both values are specified, find exact matches for both
      if (activeValue !== null && activeValue !== undefined && 
          inactiveValue !== null && inactiveValue !== undefined) {
        if (currentActiveValue === activeValue && currentInactiveValue === inactiveValue) {
          result.selectedCounty = {
            county: countyNames[i],
            state: stateNames[i],
            activeValue: currentActiveValue,
            inactiveValue: currentInactiveValue,
            index: i
          };
          break; // Found a perfect match
        }
      } 
      // If only active value is specified
      else if (activeValue !== null && activeValue !== undefined) {
        if (currentActiveValue === activeValue) {
          result.selectedCounty = {
            county: countyNames[i],
            state: stateNames[i],
            activeValue: currentActiveValue,
            inactiveValue: currentInactiveValue,
            index: i
          };
          break; // Found a match for active value
        }
      } 
      // If only inactive value is specified
      else if (inactiveValue !== null && inactiveValue !== undefined) {
        if (currentInactiveValue === inactiveValue) {
          result.selectedCounty = {
            county: countyNames[i],
            state: stateNames[i],
            activeValue: currentActiveValue,
            inactiveValue: currentInactiveValue,
            index: i
          };
          break; // Found a match for inactive value
        }
      }
    }

    return result;
  };

  return (
    <Card className="w-full mx-auto">
      <CardHeader className="relative pb-0">
        <CardTitle className="flex justify-between">
          Death Rate Differential by {currentLaw || law}
          <div className="absolute top-6 right-6 z-10 flex space-x-2">
            <Button onClick={toggleNegativeInactive} className="mr-2">
              <BarChart2 />
            </Button>
            <Button onClick={toggleView}>
              {showTable ? "Show Chart" : "Show Table"}
            </Button>
          </div>
        </CardTitle>
        <CardDescription>{currentLaw || law} Status Comparison</CardDescription>
      </CardHeader>
      <div className="relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : null}
        <CardContent>
          <div className="space-y-4">
            {showTable ? (
              <DataTable 
                county_names={countyData}
                state_names={stateData}
                histData={histData}
              />
            ) : (
              <>
                <div className="relative">
                  {/* Absolutely positioned mean values */}
                  <div className="absolute top-0 right-0 z-10 p-2 bg-background/70 rounded border text-xs">
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "hsla(217, 91%, 60%, 1)" }}></span>
                      <span>Inactive Mean: {formatMean(statInfo?.inactiveMean)}</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "hsla(25, 95%, 50%, 1)" }}></span>
                      <span>Active Mean: {formatMean(statInfo?.activeMean)}</span>
                    </div>
                    
                    {/* County information box */}
                    {(activeHighlightedValue !== null || inactiveHighlightedValue !== null) && (
                      <div className="mt-3 pt-2 border-t">
                        <h4 className="text-xs font-bold mb-1">Selected County</h4>
                        
                        {(() => {
                          const countyDataRes = findCountyByValues(
                            countyData, stateData, histData, 
                            activeHighlightedValue, inactiveHighlightedValue
                          );
                          
                          if (countyDataRes?.selectedCounty) {
                            return (
                              <div>
                                <div className="font-semibold">{countyDataRes.selectedCounty.county}</div>
                                <div className="text-xs text-muted-foreground mb-1">{countyDataRes.selectedCounty.state}</div>
                                
                                {countyDataRes.selectedCounty.activeValue !== null && (
                                  <div className="flex items-center text-xs mb-1">
                                    <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "hsla(25, 95%, 50%, 1)" }}></span>
                                    <span>Active: {countyDataRes.selectedCounty.activeValue.toFixed(3)}</span>
                                  </div>
                                )}
                                
                                {countyDataRes.selectedCounty.inactiveValue !== null && (
                                  <div className="flex items-center text-xs">
                                    <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "hsla(217, 91%, 60%, 1)" }}></span>
                                    <span>Inactive: {countyDataRes.selectedCounty.inactiveValue.toFixed(3)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-xs">
                                {inactiveHighlightedValue !== null && (
                                  <div className="flex items-center">
                                    <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "hsla(217, 91%, 60%, 1)" }}></span>
                                    <span>Inactive: {(inactiveHighlightedValue || 0).toFixed(3)}</span>
                                  </div>
                                )}
                                {activeHighlightedValue !== null && (
                                  <div className="flex items-center mb-1">
                                    <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "hsla(25, 95%, 50%, 1)" }}></span>
                                    <span>Active: {(activeHighlightedValue || 0).toFixed(3)}</span>
                                  </div>
                                )}
                                
                                <div className="text-xs italic mt-1">No exact county match found</div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                  
                  <ChartContainer
                    config={{
                      lawInactive: {
                        label: "Law Inactive",
                        color: "hsla(217, 91%, 60%, 0.7)",
                      },
                      lawActive: {
                        label: "Law Active",
                        color: "hsla(25, 95%, 60%, 0.7)",
                      },
                    }}
                    className="h-[33vh] w-full"
                  >
                    <AreaChart
                      accessibilityLayer
                      data={histogramData}
                      margin={{
                        left: 12,
                        right: 12,
                      }}
                    >
                      <defs>
                        { negativeInactive ? (
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="4%" stopColor="hsla(217, 91%, 60%, 0.7)" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="hsla(217, 91%, 60%, 0.7)" stopOpacity={0.9}/>
                          </linearGradient>
                        ) : (
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="4%" stopColor="hsla(217, 91%, 60%, 0.7)" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="hsla(217, 91%, 60%, 0.7)" stopOpacity={0.1}/>
                          </linearGradient>
                        )}
                        <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="4%" stopColor="hsla(25, 95%, 60%, 0.7)" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="hsla(25, 95%, 60%, 0.7)" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="range"
                        angle={-27}
                        textAnchor="end"
                        tickSize={10}
                        height={60}
                        interval={3}
                        label={{
                          value: "Death Rate Differential Range",
                          position: "bottom",
                          dy: -16,
                          dx: -150,
                          style: { fontStyle: "bold" },
                        }}
                      />
                      <XAxis
                        type="number"
                        domain={[minValue, maxValue]}
                        orientation="top"
                        xAxisId={1}
                        axisLine={false}
                        tick={false}
                        tickLine={false}
                      />
                      <YAxis
                        label={{
                          value: "Frequency",
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" />
                      <Area
                        dataKey="lawInactive"
                        fill="url(#colorUv)"
                        type="step"
                        stroke="hsla(217, 100%, 60%, 1)"
                      />
                      <Area 
                        dataKey="lawActive" 
                        fill="url(#colorPv)" 
                        type="step" 
                        stroke="hsla(25, 95%, 50%, 1)"
                      />

                      {/* Add direct reference lines for highlighted values */}
                      {activeHighlightedValue !== null && activeHighlightedValue !== undefined && (
                        <ReferenceLine
                          x={activeHighlightedValue}
                          xAxisId={1}
                          stroke="hsla(25, 95%, 50%, 1)"
                          strokeWidth={2}
                          label={{
                            value: `Selected Active: ${activeHighlightedValue.toFixed(2)}`,
                            position: "insideBottomRight",
                            dy: -10,
                            fill: "hsla(25, 95%, 50%, 1)"
                          }}
                        />
                      )}
                      {inactiveHighlightedValue !== null && inactiveHighlightedValue !== undefined && (
                        <ReferenceLine
                          x={inactiveHighlightedValue}
                          xAxisId={1}
                          stroke="hsla(217, 91%, 60%, 1)"
                          strokeWidth={2}
                          label={{
                            value: `Selected Inactive: ${inactiveHighlightedValue.toFixed(2)}`,
                            position: "insideBottomLeft",
                            dy: -50,
                            fill: "hsla(217, 91%, 60%, 1)"
                          }}
                        />
                      )}

                      <ReferenceLine
                        x={statInfo?.inactiveMean}
                        xAxisId={1}
                        label={{
                          value: `Inactive Mean: ${formatMean(statInfo?.inactiveMean)}`,
                          position: "top",
                          dy: 20,
                          dx: 75,
                          style: { fill: "hsla(217, 91%, 60%, 1)", fontStyle: "bold", fontSize: "14px" },
                        }}
                        stroke="hsla(217, 91%, 60%, 1)"
                        strokeDasharray="3 3"
                        strokeWidth={2}
                      />
                      <ReferenceLine
                        x={statInfo?.activeMean}
                        xAxisId={1}
                        label={{
                          value: `Active Mean: ${formatMean(statInfo?.activeMean)}`,
                          position: "top",
                          dy: 40,
                          dx: 70,
                          style: { fill: "hsla(25, 95%, 50%, 1)", fontStyle: "bold", fontSize: "14px" },
                        }}
                        stroke="hsla(25, 95%, 50%, 1)"
                        strokeDasharray="3 3"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
              </>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default HistogramChart