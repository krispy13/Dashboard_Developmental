// Page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import MetricCard from "./cards/metric"; // Ensure correct path and casing
import DropdownCard from "./cards/dropdown-card"; // Ensure correct path and casing
import MultiSliderDashboard from "./cards/multislider-card"; 
import HistogramChart from "@/components/histogramChart";
import { ModeToggle } from "@/components/theme-change";
import { UploadDataDialog } from "@/components/upload-data-dialog";
import { StatisticalInfo } from "@/components/histogramChart"; // Adjust the path as necessary
import debounce from "lodash/debounce";
import MapWrapper from "@/components/mapwrapper";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { XCircle, Loader2, Upload } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

/*   
*************************************************************
                    **** INTERFACES  ****
*************************************************************
*/

interface SliderConfig {
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: [number, number];
}

interface Constraint {
  [key: string]: {
    lb: number;
    ub: number;
  };
}

interface UserPattern {
  constraints: Constraint|null;
  law: string;
  activeRange: [number, number];   
  inactiveRange: [number, number];
}

interface HistogramAPIResponse {
  cleaned_conds: string[];
  histogram_data: [number[], number[]];
  ite_scores: [number, number];
  test_scores: [number, number, number, number, number];
  feature_importance?: {
    features: string[];
    importance: number[];
  };
  column_histograms?: {
    [key: string]: {
      counts: number[];
      bin_edges: number[];
    }
  };
  full_column_histograms?: {
    [key: string]: {
      counts: number[];
      bin_edges: number[];
    }
  };
}

/*   
*************************************************************
                    **** END INTERFACES ****
*************************************************************
*/

export default function Page() {
/*   
*******************************************************************************************
                            **** STATES TO HOLD DATA  ****
*******************************************************************************************
*/

  // State to hold selected pattern and law upon submission
  // const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({
  //   pattern: 7, // Default pattern number
  //   law: "goodsam-law", // Default law
  // });

  const selectedOptions = {pattern: 7, law: "goodsam-law"};

  const [dataColumns, setDataColumns] = useState<string[]>([]);
  const [columnRanges, setColumnRanges] = useState<{[key: string]: {min: number, max: number}}>({});

  const [controlVariable, setControlVariable] = useState<string>("delta_death_rate");

  // State to hold the current pattern for fetching constraints
  const [currentPattern, setCurrentPattern] = useState<number>(7); // Initially same as selectedOptions.pattern

  // State to hold current law
  const [currentLaw, setCurrentLaw] = useState<string>("goodsam-law");

  // State to hold statistical information
  const [statInfo, setStatInfo] = useState<StatisticalInfo | null>(null);

  // State for K-Fold Cross Validation score
  const [kFoldScore, setKFoldScore] = useState<number|null>(null);

  // State to hold constraints
  const [constraints, setConstraints] = useState<Constraint | null>(null);
  
  const [activeRange, setActiveRange] = useState<[number, number]>([0, 0.4]);
  const [inactiveRange, setInactiveRange] = useState<[number, number]>([0.6, 1]);

  const [rangeOverlap, setRangeOverlap] = useState<boolean>(false);

  // state to hold geomap data (FIPS Codes)
  const [geomapData, setGeomapData] = useState<number[] | null>(null);

  // State to hold histogram data
  const [histoData, setHistoData] = useState<HistogramAPIResponse | null>(null);

  // State to hold county names
  const [countyNames, setcountyNames] = useState<string[] | null>(null);

  // State to hold state names (States of the USA)  
  const [stateNames, setStateNames] = useState<string[] | null>(null);

  // State to hold sliders
  const [sliders, setSliders] = useState<SliderConfig[]>([]);

  // State for loading and errors
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeomapLoading, setIsGeomapLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Add new state for map view mode
  const [mapViewMode, setMapViewMode] = useState<"all" | "dual" | "active" | "inactive">("all");

  // Add states for active and inactive counties
  const [activeGeomapData, setActiveGeomapData] = useState<number[] | null>(null);
  const [inactiveGeomapData, setInactiveGeomapData] = useState<number[] | null>(null);

  const [highlightedCounty, setHighlightedCounty] = useState<number | null>(null);
  const [highlightedActiveVal, setHighlightedActiveVal] = useState<number | null>(null);
  const [highlightedInactiveVal, setHighlightedInactiveVal] = useState<number | null>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false) // State for upload dialog

  const [featureImportance, setFeatureImportance] = useState<{
    features: string[];
    importance: number[];
  } | null>(null);

  const [columnHistograms, setColumnHistograms] = useState<{
    [key: string]: {
      counts: number[];
      bin_edges: number[];
    }
  } | null>(null);

  const [fullColumnHistograms, setFullColumnHistograms] = useState<{
    [key: string]: {
      counts: number[];
      bin_edges: number[];
    }
  } | null>(null);

  const [showingFeatureImportance, setShowingFeatureImportance] = useState(false);


/*   
*******************************************************************************************
                                  **** END STATES ****
*******************************************************************************************
*/

/*   
*******************************************************************************************
                **** FUNCTIONS FOR PRE-EXISTING PATTERNS RELATED DATA  ****
*******************************************************************************************
  1. def fetchConstraints: 
    - For existing pattern ID, fetches data from Python backend
    - Data fetched:
      -> constraints: attributes in pattern with their bounds
      -> countiesIndices: FIPS codes for the counties that are present in the pattern
      -> constraintsBounds: min and max bounds for the attributes in the pattern
      -> law: the law present in the pattern (can be empty)

  2. def handlePatternChange:
    - For exisitng pattern ID, invokes fetchConstraints to communicate with backend
    - Data updated:
      -> constraints for pattern fetched
      -> sliders for the constraints
      -> geomap to highlight counties present in pattern
      -> law in pattern
      -> user-set-pattern (as a base)

  3. def handleSubmit: (deprecated)
    - To run BART for the user chosen pattern
    - Updates histogram
    - Replaced by "handleUserPatternSubmit"
  
  4. def fetchDataColumns:
    - Fetches data columns from Python backend for dropdowns
    - Updates local state with the data fetched 

*******************************************************************************************
*/

  // Function to fetch constraints based on currentPattern (Pre-existing Patterns)
  const fetchConstraints = async (patternId: number) => {
    try {
      const response = await fetch(`/api/constraints?ID=${patternId}`);
      if (!response.ok) {
        throw new Error(`Error fetching constraints: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        constraints: data.constraints as Constraint,
        countiesIndices: data.countiesIndices,
        constraintsBounds: data.constraintsBounds as Constraint,
        law : data.law,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  
  // Function to handle pattern change (Pre-existing Patterns)
  const handlePatternChange = async (pattern: number) => {
    setIsLoading(true);
    setError(null); // Reset error state
    const patternId = pattern - 1; // Adjusting for 0-indexed CSV
    const fetchedConstraints = await fetchConstraints(patternId);
    if (fetchedConstraints) {
      setConstraints(fetchedConstraints.constraints);
      //console.log(fetchedConstraints);
      const generatedSliders = generateSlidersFromConstraints(fetchedConstraints.constraints, fetchedConstraints.constraintsBounds,fetchedConstraints.law );
      setSliders(generatedSliders);
      setGeomapData(fetchedConstraints.countiesIndices);     
      setCurrentLaw(fetchedConstraints.law); 
      console.log(currentLaw)
      console.log(constraints);
      // setUserPattern({constraints: fetchedConstraints.constraints, law: fetchedConstraints.law});
    } else {
      setConstraints(null);
      setSliders([]);
      setError("Failed to fetch constraints for the selected pattern.");
    }
    setIsLoading(false);
  };

  const fetchDataColumns = async () => {
    try {
      // Fetch columns
      const columnsResponse = await fetch("/api/columns");
      if (!columnsResponse.ok) {
        throw new Error(`Error fetching columns: ${columnsResponse.statusText}`);
      }
      const columnsData = await columnsResponse.json();
      setDataColumns(columnsData.columns);
      
      // Set default control variable if available and none is selected
      if (!controlVariable && columnsData.columns.length > 0) {
        const defaultControl: string | undefined = columnsData.columns.find((col: string) => col === "delta_death_rate") || 
                  columnsData.columns.find((col: string) => col.includes("death-rate")) ||
                  columnsData.columns.find((col: string) => col.includes("rate")) ||
                  columnsData.columns[columnsData.columns.length - 1]; // Last column as fallback
        
        if (defaultControl) {
          console.log("Setting default control variable:", defaultControl);
          setControlVariable(defaultControl);
        }
      }
      
      // Set default law if no law is currently selected
      if (!currentLaw && columnsData.columns.length > 27) {
        const lawColumn = columnsData.columns[27]; // First law column
        console.log("Setting default law:", lawColumn);
        setCurrentLaw(lawColumn);
      }
  
      // Fetch column ranges
      const rangesResponse = await fetch("/api/column-ranges");
      if (!rangesResponse.ok) {
        throw new Error(`Error fetching column ranges: ${rangesResponse.statusText}`);
      }
      const rangesData = await rangesResponse.json();
      setColumnRanges(rangesData.columnRanges);
      console.log("Fetched column ranges:", rangesData.columnRanges);
      
    } catch (error) {
      console.error("Error fetching columns or ranges:", error);
    }
  };

/*   
*******************************************************************************************
                                  **** END PRE-SET PATTERN ****
*******************************************************************************************
*/

/*   
*******************************************************************************************
                        **** FUNCTIONS FOR USER-SET PATTERN ****
*******************************************************************************************
  User-Set Pattern:
    - State that tracks the pattern set by user
    - Data:
      -> constraints: set using sliders
      -> law/treatment: set using treatment dropdown  

  1. def handleLawChange:
    - When new treatment is chosen in dropdown, update local states -> law & user-set pattern
  
  2. def handleControlChange:
    - When new control variable is chosen in dropdown, update local state -> control variable 

  3. def handleConstraintsChange:
    - When user updates values in sliders, update local states of:
      -> constraints
      -> sliders
      -> user-set pattern

  4. def fetchMapHist:
    - Fetch data from Python backend for user-set pattern 
    - Data fetched:
      -> FIPS codes of counties in pattern
      -> Histogram & metrics data from BART
    - If there are no counties in pattern (empty dataframe), return error message

  5. def handleUserPatternSubmit:
    - For a user-set pattern, invokes "fetchMapHist" & gets data 
    - If no data (error), displays alert message
    - Else, updates local states -> geomap & histogram-metrics data
  
  6. def fetchGeomapOnly
  - Fetches data from Python backend for user-set pattern for geomap ONLY (No BART)
  - Data fetched:
    -> FIPS codes of counties in pattern  
    -> If no data, return empty arrays for counties & states

*******************************************************************************************
*/

  const handleLawChange = (law: string) => {
    setCurrentLaw(law);
    
    // Initialize ranges for the new law
    let newActiveRange: [number, number] = [0, 0.4];
    let newInactiveRange: [number, number] = [0.6, 1];
    
    if (columnRanges[law]) {
      const { min, max } = columnRanges[law];
      // Set default ranges - active in lower 40%, inactive in upper 40%
      newActiveRange = [min, min + (max - min) * 0.4];
      newInactiveRange = [min + (max - min) * 0.6, max];
    }
    
    // Set the range states
    setActiveRange(newActiveRange);
    setInactiveRange(newInactiveRange);

    const updatedUserPattern = {
      constraints: constraints, 
      law: law,
      activeRange: newActiveRange,
      inactiveRange: newInactiveRange
    };
    console.log("Handle Law Change! ");
    console.log(law);
    console.log(updatedUserPattern);
    console.log(error);

    if (constraints) {
      console.log("Fetching geomap data with updated law...");
      debouncedFetchGeomap(updatedUserPattern);
    }
  };

  const handleActiveRangeChange = (range: [number, number], law: string) => {
    setActiveRange(range);
    console.log("Active range changed to:", range);
    if (constraints) {
      const updatedUserPattern = {
        constraints: constraints,
        law: law,
        activeRange: range,
        inactiveRange: inactiveRange
      };
      debouncedFetchGeomap(updatedUserPattern);
    }
  };
  
  const handleInactiveRangeChange = (range: [number, number], law: string) => {
    setInactiveRange(range);
    console.log("Inactive range changed to:", range);
    if (constraints) {
      const updatedUserPattern = {
        constraints: constraints,
        law: law,
        activeRange: activeRange,
        inactiveRange: range
      };
      debouncedFetchGeomap(updatedUserPattern);
    }
  };

  const handleControlChange = (control: string) => {
    setControlVariable(control);
    console.log("Control variable changed to:", control);
  }

  // Function to only update geomap data (lightweight, no BART)
  const fetchGeomapOnly = async (uPattern: UserPattern) => {
    try {
      const response = await fetch("/api/geomapFilter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uPattern),
      });
      
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Error fetching geomap data: ${response.statusText}`);
      }
      
      return {
        countiesIndices: data.countiesIndices,
        countyNames: data.countyNames,
        stateNames: data.stateNames,
        activeCountiesIndices: data.activeCountiesIndices,
        inactiveCountiesIndices: data.inactiveCountiesIndices,
      };
    } catch (error) {
      console.error("Error fetching geomap data:", error);
      // Don't show alert for geomap-only updates
      return { countiesIndices: [], countyNames: [], stateNames: [] };
    }
  };

  // Function to get FIPS codes and Histogram data
  const fetchMapHist = async (uPattern: UserPattern) => {
    try {
      const response = await fetch("/api/userPattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uPattern),
      });
  
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Error fetching constraints: ${response.statusText}`);
      }
      return {
        countiesIndices: data.countiesIndices,
        histData: data.histData,
        countyNames: data.countyNames,
        stateNames: data.stateNames,
        activeCountiesIndices: data.activeCountiesIndices,
        inactiveCountiesIndices: data.inactiveCountiesIndices,
      };
    } catch (error) {
      console.error(error);
      alert("There are no counties in the chosen Pattern");
      return null;
    }
  };
  
  // Function to fetch cross-validation data and return the promise
  const fetchCrossVal = async (uPattern: UserPattern) => {
    try {
      const response = await fetch("/api/crossVal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uPattern),
      });
  
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Error fetching constraints: ${response.statusText}`);
      }
      return { kFoldNRmse: data.kFoldNRMSE };
    } catch (error) {
      console.error(error);
      alert("Error fetching cross-validation data");
      return null;
    }
  };

  // Create a debounced version that uses the lightweight endpoint
  const debouncedFetchGeomap = useCallback(
    debounce(async (userPatternData: UserPattern) => {
      console.log("Fetching map data with lightweight endpoint...");
      console.log(userPatternData);
      if (userPatternData.activeRange && userPatternData.inactiveRange){
        if(checkRangeOverlap(userPatternData.activeRange, userPatternData.inactiveRange)) {
          setRangeOverlap(true);
        } else {
          setRangeOverlap(false);
          setIsGeomapLoading(true);
          
          const fetchedData = await fetchGeomapOnly(userPatternData);
          if (fetchedData) {
            setGeomapData(fetchedData.countiesIndices);
            setActiveGeomapData(fetchedData.activeCountiesIndices);
            setInactiveGeomapData(fetchedData.inactiveCountiesIndices);
          }
          
          setIsGeomapLoading(false);
        }
      } 
    }, 300), // Reduced debounce time since this endpoint should be faster
    []
  );

  // Function to update constraints when sliders change
  const handleConstraintsChange = (newPattern: {sliders: SliderConfig[], constraints: Constraint|null}) => {
    setConstraints(newPattern.constraints);
    setSliders(newPattern.sliders);

    const updatedUserPattern = {
      constraints: newPattern.constraints, 
      law: currentLaw,
      activeRange: activeRange,
      inactiveRange: inactiveRange
    };
    
    console.log("Constraints updated!");
    
    // Use the debounced function to update the geomap
    if (newPattern.constraints) {
      debouncedFetchGeomap(updatedUserPattern);
    }
  }

  // Function to handle onSubmit for user-set pattern
  const handleUserPatternSubmit = async (user: UserPattern) => {
    setIsLoading(true);
    setError(null);

    console.log("User Pattern Submit:", {
      constraints: user.constraints,
      law: user.law,
      activeRange: user.activeRange,
      inactiveRange: user.inactiveRange
    });

    setKFoldScore(null)
  
    // Ensure threshold values are included
    const userWithThreshold = {
      ...user,
      activeRange: activeRange,
      inactiveRange: inactiveRange
    };
  
    // Fetch map history (runs in parallel)
    const fetchMapHistPromise = fetchMapHist(userWithThreshold);
    
    // Fetch cross-validation data (runs in parallel)
    const fetchCrossValPromise = fetchCrossVal(userWithThreshold);
    
    // Once fetchMapHist completes, update state
    const fetchedData = await fetchMapHistPromise;
    if (!fetchedData) {
      setError("Failed to fetch data.");
      setIsLoading(false);
      return;
    }
  
    if (fetchedData.countiesIndices === 400) {
      setError("No data available for the selected constraints.");
      alert("There are no counties in the chosen pattern");
    } else {
      console.log(Date.now(), "Fetched map and hist data");
      setGeomapData(fetchedData.countiesIndices);
      setActiveGeomapData(fetchedData.activeCountiesIndices);
      setInactiveGeomapData(fetchedData.inactiveCountiesIndices);
      setHistoData(fetchedData.histData);
      setcountyNames(fetchedData.countyNames);
      setStateNames(fetchedData.stateNames);
  
      if(highlightedCounty){
        setHighlightedCounty(-1);
        setHighlightedActiveVal(null);
        setHighlightedInactiveVal(null);
      }
  
      setIsLoading(false);
    }
  
    // Once fetchCrossVal completes, update statInfo
    fetchCrossValPromise.then(crossValData => {
      if (crossValData) {
        setKFoldScore(crossValData.kFoldNRmse);  // Update the statInfo state
        // console.log(Date.now())
        // console.log("Fetched K fold score")
        // console.log(crossValData.kFoldNRmse)
      }
        // Stop loading after both operations are done
    }).catch((error) => {
      console.error(error);
      alert("Error fetching cross-validation data");
      setIsLoading(false);
    });
  };

/*   
*******************************************************************************************
                                  **** END USER-SET PATTERN ****
*******************************************************************************************
*/

/*   
*******************************************************************************************
              **** GENERATING SLIDERS FROM CONSTRAINTS - EXISTING PATTERNS ****
*******************************************************************************************
  def generateSlidersFromConstraints:
    - Input data:
      -> constraints - variables in pattern with resp. lower and upper bound
      -> constraintsBounds - variables in pattern with resp. min & max values
      -> law - law in pattern (may be empty)
    - Output:
      -> sliders - local variable that stores all slider values as {constraint, min, max, step, [lower bound, upper bound]}
      -> used to update local state in "handlePatternChange"

    - Treatment/law is not considered as a constraint and is skipped
    - Min and Max values for each constraint is extracted from "constraintBounds"
    - If either lower or upper bound is infinity, set to random value 
    - Define step size based on range (max - min) of each constraint

*******************************************************************************************
*/

  // Function to generate slider configurations from constraints
  const generateSlidersFromConstraints = (constraints: Constraint, constraintsBounds: Constraint, law: string): SliderConfig[] => {
    const sliders: SliderConfig[] = [];
    for (const [constraintName, bounds] of Object.entries(constraints)) {
      if(law === constraintName) continue;
      let { lb, ub } = bounds;

      // Handle infinite bounds by setting reasonable defaults
      const MAX_VALUE = 1000; // Adjust as needed
      const MIN_VALUE = -1000; // Adjust as needed

      if (lb === -Infinity) {
        lb = MIN_VALUE;
      }
      if (ub === Infinity) {
        ub = MAX_VALUE;
      }

      const minMaxBounds = constraintsBounds[constraintName];
      const min = minMaxBounds["lb"];
      const max = minMaxBounds["ub"];

      // Determine step based on the range
      const range = max - min;
      let step = 1;
      if (range <= 5) step = 0.01;
      if (range >= 100) step = 0.1;
      if (range > 1000) step = 10;

      const defaultValue :[number, number] = [lb, ub];

      sliders.push({
        name: constraintName,
        min: min,
        max: max,
        step: step,
        defaultValue: defaultValue,
      });
    }
    return sliders;
  };

/*   
*******************************************************************************************
                                  **** END SLIDERS  ****
*******************************************************************************************
*/

  const handleDataFileChanged = () => {
    console.log("Data file changed, refreshing data");
    
    // Fetch updated columns and ranges
    fetchDataColumns();
    
    // Reset current selections to defaults or first available options
    setCurrentLaw(""); // Will be updated when columns are fetched
    setControlVariable(""); // Will be updated when columns are fetched
    
    // Reset data states
    setGeomapData(null);
    setActiveGeomapData(null);
    setInactiveGeomapData(null);
    setHistoData(null);
    setStatInfo(null);
    setKFoldScore(null);
    setFeatureImportance(null);
    
    // Clear constraints and sliders
    setConstraints(null);
    setSliders([]);
    
    // Reset column ranges (will be refetched)
    setColumnRanges({});
  }

  const handleCountyClick = (countyId: number) => {
    console.log("County clicked:", countyId, typeof countyId);
    if(geomapData){
      
      // More reliable search that handles type conversion
      const index = geomapData.findIndex(id => Number(id) === Number(countyId));
      console.log("Found index using findIndex:", index);
    
      if (index !== -1 && histoData) {
          setHighlightedInactiveVal(histoData.histogram_data[0][index]);
          setHighlightedActiveVal(histoData.histogram_data[1][index]);
          setHighlightedCounty(countyId);
          console.log("Highlighted County: ", index);
          console.log("Highlighted Active Value: ", histoData.histogram_data[1][index]);
          console.log("Highlighted Inactive Value: ", histoData.histogram_data[0][index]);
      } else {
          console.log("County not found in dataset");
      }
    }
  };

  const checkTestsPassing = (statInfo: StatisticalInfo | null): boolean => {
    if (!statInfo) return true; // Default to true if no data
    
    // Define test conditions
    // const passingConditions = {
    //   pairedTPValue: (value: number) => value < 0.05,
    //   mannWhitneyPValue: (value: number) => value < 0.05,
    //   avgITE: (value: number) => Math.abs(value) > 0,
    //   stdevITE: (value: number) => value > 0,
    //   imbalanceRatio: (value: number) => value<=10,
    //   cohensD: (value: number) => value>=0.2
    // };
    
    // Check if all tests pass
    // return (
    //   passingConditions.pairedTPValue(statInfo.pairedTPValue) &&
    //   passingConditions.mannWhitneyPValue(statInfo.mannWhitneyPValue) &&
    //   passingConditions.avgITE(statInfo.avgITE) &&
    //   passingConditions.stdevITE(statInfo.stdevITE) &&
    //   passingConditions.imbalanceRatio(statInfo.imbalanceRatio) &&
    //   passingConditions.cohensD(statInfo.cohensD)
    // );

    return true; // Temporarily return true for testing
  };

  const checkRangeOverlap = (range1: [number, number], range2: [number, number]): boolean => {
    return Math.max(range1[0], range2[0]) <= Math.min(range1[1], range2[1]);
  };

  const processHistogramData = (histData: HistogramAPIResponse | null): StatisticalInfo | null => {
    if (!histData) return null;
    
    // Compute means from histogram data
    const calculateMean = (data: number[]): number => {
      if (data.length === 0) return 0;
      const sum = data.reduce((acc, val) => acc + val, 0);
      return sum / data.length;
    };
    
    const inactiveMean = calculateMean(histData.histogram_data[0]);
    const activeMean = calculateMean(histData.histogram_data[1]);
    
    // Extract test scores and ITE values
    const mannWhitneyPValue = histData.test_scores[0];
    const pairedTPValue = histData.test_scores[1];
    const imbalanceRatio = histData.test_scores[3];
    const cohensD = histData.test_scores[4];
    
    // Return the processed statistical information
    return {
      inactiveMean,
      activeMean,
      pairedTPValue,
      mannWhitneyPValue,
      avgITE: histData.ite_scores[0],
      stdevITE: histData.ite_scores[1],
      imbalanceRatio,
      cohensD
    };
  };

  const handleMetricViewChange = (isShowingFeatureImportance: boolean) => {
    setShowingFeatureImportance(isShowingFeatureImportance);
  };  

  // useEffect to fetch constraints whenever currentPattern changes
  useEffect(() => {
    handlePatternChange(currentPattern);
  }, [currentPattern]);

  useEffect(() => {
    // No need to store test status in state, we can compute it when needed
    console.log("Statistical info updated:", statInfo);
  }, [statInfo]);

  useEffect(() => {
    // No need to store test status in state, we can compute it when needed
    console.log("K-fold info updated:", kFoldScore);
  }, [kFoldScore]);

  // useEffect to fetch constraints on initial load
  useEffect(() => {
    fetchDataColumns();
    handlePatternChange(currentPattern);
  }, []);

  useEffect(() => {
    if (histoData) {
      const newStatInfo = processHistogramData(histoData);
      if (newStatInfo) {
        console.log("Updating stat info:", newStatInfo);
        setStatInfo(newStatInfo);
      }

      // Extract feature importance if available
      if (histoData.feature_importance) {
        console.log("Feature importance data:", histoData.feature_importance);
        setFeatureImportance(histoData.feature_importance);
      } else {
        setFeatureImportance(null);
      }

      if (histoData.column_histograms) {
        setColumnHistograms(histoData.column_histograms);
      } else {
        setColumnHistograms(null);
      }

      if (histoData.full_column_histograms) {
        setFullColumnHistograms(histoData.full_column_histograms);
      } else {
        setFullColumnHistograms(null);
      }
    }
  }, [histoData]);

  
  const activeCount = activeGeomapData?.length || 0
  const inactiveCount = inactiveGeomapData?.length || 0
  const totalCount = 3137

  const chartData = [
    {
      name: "Counties",
      lawActive: activeCount,
      lawInactive: inactiveCount,
    },
  ]
 
  return (
    <>
      <div className="mb-4 flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">⚖️ Legal Dashboard</h1>
        <div className="flex items-center space-x-2">
          <ModeToggle />
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Set Data Files
          </Button>
          <Button>Download</Button>
          <UploadDataDialog 
            open={uploadDialogOpen} 
            onOpenChange={setUploadDialogOpen} 
            onDataFileChanged={handleDataFileChanged} 
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-10">
        {/* Map container with relative positioning */}
        <div className="lg:col-span-4">
          <div className="relative w-full">
            {/* Map toggle buttons - positioned absolutely in top right */}
            <div className="absolute top-2 right-2 flex space-x-1 z-10">
              <Button 
                size="sm"
                variant={mapViewMode === "all" ? "default" : "outline"} 
                onClick={() => setMapViewMode("all")}
                className="text-xs py-1 h-8"
              >
                All
              </Button>
              <Button 
                size="sm"
                variant={mapViewMode === "dual" ? "default" : "outline"} 
                onClick={() => setMapViewMode("dual")}
                className="text-xs py-1 h-8"
              >
                Dual
              </Button>
              <Button 
                size="sm"
                variant={mapViewMode === "active" ? "default" : "outline"} 
                onClick={() => setMapViewMode("active")}
                className="text-xs py-1 h-8"
              >
                Active
              </Button>
              <Button 
                size="sm"
                variant={mapViewMode === "inactive" ? "default" : "outline"} 
                onClick={() => setMapViewMode("inactive")}
                className="text-xs py-1 h-8"
              >
                Inactive
              </Button>
            </div>

            {/* County Distribution Card - positioned absolutely at the bottom */}
            <div className="absolute bottom-2 left-2 right-2 z-10 max-w-[430px]">
              <Card className="bg-background/90 backdrop-blur-sm border shadow-md">
                <CardContent className="py-1 px-3">
                  <div className="space-y-1">
                    {/* Count display */}
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsla(25, 95%, 55%, 0.8)" }}></div>
                        <span>Active: {activeGeomapData?.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsla(217, 91%, 60%, 0.8)" }}></div>
                        <span>Inactive: {inactiveGeomapData?.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsla(0, 0%, 80%, 0.8)" }}></div>
                        <span>Rest: {(3137 - (inactiveGeomapData?.length || 0) - (activeGeomapData?.length || 0))}</span>
                      </div>
                    </div>
                    
                    {/* Bar chart using Recharts */}
                    <div className="h-6 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={chartData.map(item => ({
                            ...item,
                            lawRest: totalCount - (item.lawActive + item.lawInactive)
                          }))} 
                          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                        >
                          <XAxis
                            type="number"
                            hide
                            domain={[0, totalCount]} // Set domain from 0 to total count
                          />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip
                            cursor={false}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const activeData = payload.find((p) => p.dataKey === "lawActive")
                                const inactiveData = payload.find((p) => p.dataKey === "lawInactive")
                                const restData = payload.find((p) => p.dataKey === "lawRest")

                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm z-50">
                                    <div className="text-xs font-medium mb-1">County Distribution</div>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: "hsla(25, 95%, 55%, 0.5)" }}
                                        ></div>
                                        <span className="text-[0.70rem] text-muted-foreground">Active:</span>
                                        <span className="text-[0.70rem] font-medium">{activeData?.value || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: "hsla(217, 91%, 60%, 0.5)" }}
                                        ></div>
                                        <span className="text-[0.70rem] text-muted-foreground">Inactive:</span>
                                        <span className="text-[0.70rem] font-medium">{inactiveData?.value || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: "hsla(0, 0%, 80%, 0.5)" }}
                                        ></div>
                                        <span className="text-[0.70rem] text-muted-foreground">Rest:</span>
                                        <span className="text-[0.70rem] font-medium">{restData?.value || 0}</span>
                                      </div>
                                      <div className="text-[0.70rem] text-muted-foreground pt-1 border-t">
                                        Total: {totalCount}
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Bar
                            dataKey="lawActive"
                            fill="hsla(25, 95%, 55%, 0.8)"
                            stroke="hsla(25, 95%, 50%, 1)"
                            strokeWidth={1}
                            stackId="stack"
                            animationDuration={1000}
                            animationEasing="ease-in-out"
                            radius={[4, 0, 0, 4]}
                            minPointSize={2}
                          />
                          <Bar
                            dataKey="lawInactive"
                            fill="hsla(217, 91%, 60%, 0.8)"
                            stroke="hsla(217, 100%, 60%, 1)"
                            strokeWidth={1}
                            stackId="stack"
                            animationDuration={1000}
                            animationEasing="ease-in-out"
                            radius={[0, 0, 0, 0]}
                            minPointSize={2}
                          />
                          <Bar
                            dataKey="lawRest"
                            fill="hsla(0, 0%, 80%, 0.8)"
                            stroke="hsla(0, 0%, 70%, 1)"
                            strokeWidth={1}
                            stackId="stack"
                            animationDuration={1000}
                            animationEasing="ease-in-out"
                            radius={[0, 4, 4, 0]}
                            minPointSize={2}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Conditional rendering based on map view mode */}
            {mapViewMode === "all" && (
              <MapWrapper 
                className="w-full" 
                indices={geomapData}
                activeGeomapData={activeGeomapData}
                inactiveGeomapData={inactiveGeomapData}
                isLoading={isGeomapLoading}
                colorScheme="default"
                onCountyClick={handleCountyClick}
              />
            )}
            {mapViewMode === "dual" && (
              <MapWrapper 
                className="w-full" 
                indices={geomapData}
                activeGeomapData={activeGeomapData}
                inactiveGeomapData={inactiveGeomapData}
                isLoading={isGeomapLoading}
                colorScheme="dual"
                onCountyClick={handleCountyClick}
              />
            )}
            {mapViewMode === "active" && (
              <MapWrapper 
                className="w-full" 
                indices={activeGeomapData}
                isLoading={isGeomapLoading}
                colorScheme="active"
                onCountyClick={handleCountyClick}
              />
            )}
            {mapViewMode === "inactive" && (
              <MapWrapper 
                className="w-full" 
                indices={inactiveGeomapData}
                isLoading={isGeomapLoading}
                colorScheme="inactive"
                onCountyClick={handleCountyClick}
              />
            )}
          </div>
        </div>
        
        {/* Dropdown card for selecting patterns and laws */}
        <div className="lg:col-span-3">
          <DropdownCard
            onPatternChange={setCurrentPattern} 
            onLawChange={handleLawChange}
            onControlChange={handleControlChange}
            onActiveRangeChange={handleActiveRangeChange}
            onInactiveRangeChange={handleInactiveRangeChange}
            law={currentLaw}
            controlVariable={controlVariable}
            availableColumns={dataColumns}
            activeRange={activeRange}
            inactiveRange={inactiveRange}
            columnRanges={columnRanges}
            onSubmit={handleUserPatternSubmit}
            constraints={constraints}
            rangeOverlap={rangeOverlap}
          />
        </div>

        {/* Multi-slider card for constraints */}
        <div className="lg:col-span-3">
        <MultiSliderDashboard
          title="Choose the Conditions"
          description="Adjust the constraints as needed."
          sliders={sliders}
          onSliderChange={handleConstraintsChange}
          availableColumns={dataColumns} // Pass the fetched columns
          columnRanges={columnRanges}
        />
        </div>

        {/* Metric card for displaying statistical information */}
        <div className={`${showingFeatureImportance ? 'lg:col-span-5' : 'lg:col-span-3'} flex-1 transition-all duration-500`}>
          <MetricCard 
            className="h-full" 
            statInfo={statInfo} 
            isLoading={isLoading}
            kFoldScore={kFoldScore}
            featureImportance={featureImportance}
            columnHistograms={columnHistograms}
            fullColumnHistograms={fullColumnHistograms}
            onViewChange={handleMetricViewChange}
          />
        </div>

        {/* Histogram chart for displaying results */}
        <div className={`${showingFeatureImportance ? 'lg:col-span-5' : 'lg:col-span-7'} flex-1 transition-all duration-500`}>
          {isLoading ? (
            <Card className="w-full mx-auto">
              <CardHeader className="pb-0">
                <CardTitle>Death Rate Differential</CardTitle>
                <CardDescription>Standing Order (Law) Status Comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative h-[33vh]">
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading data...</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : histoData && !checkTestsPassing(statInfo) ? (
            <Card className="w-full mx-auto">
              <CardHeader>
                <CardTitle>Statistical Tests Failed</CardTitle>
                <CardDescription>Cannot display histogram due to failed statistical tests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <div className="flex items-center text-red-500 mb-4">
                    <XCircle className="w-8 h-8 mr-2" />
                    <span className="text-lg font-medium">Tests failed</span>
                  </div>
                  <p className="text-center text-muted-foreground max-w-md">
                    One or more statistical tests did not pass the required thresholds. 
                    Please adjust your parameters to create a pattern with statistically 
                    significant results.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : histoData ? (
            <HistogramChart
              selectedOptions={selectedOptions}
              histData={histoData}
              stateData={stateNames}
              countyData={countyNames}
              isLoading={false}
              currentLaw={currentLaw}
              activeHighlightedValue={highlightedActiveVal}
              inactiveHighlightedValue={highlightedInactiveVal}
            />
          ) : (
            <Card className="w-full mx-auto">
              <CardHeader className="pb-0">
                <CardTitle>No Data Available</CardTitle>
                <CardDescription>Select a pattern to view results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[33vh] text-muted-foreground">
                  Please select parameters and submit to view results
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </>
  );
}