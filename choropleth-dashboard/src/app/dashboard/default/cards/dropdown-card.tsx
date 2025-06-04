// Modified DropdownCard.tsx with integrated UserSetPattern and Range controls

"use client";

import { useState, useEffect } from "react";
import { ComboboxPattern } from "@/components/dropdown-pattern";
import { ComboboxLaw } from "@/components/dropdown-law";
import { ThresholdControl } from "@/components/thresholdControl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Constraint {
  [key: string]: {
    lb: number;
    ub: number;
  };
}

interface DropdownCardProps {
  onPatternChange: (pattern: number) => void;
  onLawChange: (law: string) => void;
  onControlChange: (control: string) => void;
  // Replace threshold props with range props
  onActiveRangeChange?: (range: [number, number], law: string) => void;
  onInactiveRangeChange?: (range: [number, number], law: string) => void;
  law: string;
  controlVariable: string;
  availableColumns: string[];
  // Replace threshold with ranges
  activeRange?: [number, number];
  inactiveRange?: [number, number];
  columnRanges?: {[key: string]: {min: number, max: number}};
  // Update onSubmit to use ranges
  onSubmit?: (setPattern: { 
    constraints: Constraint|null; 
    law: string; 
    activeRange: [number, number];
    inactiveRange: [number, number];
  }) => void;
  constraints?: Constraint | null;
  rangeOverlap?: boolean;
}

// Helper function to determine appropriate step size based on range
const determineStepSize = (min: number, max: number): number => {
  const range = max - min;
  
  // For binary variables (0-1 range)
  if (max === 1 && min === 0) {
    return 0.1;
  }
  
  // For small decimal ranges like percentages (0-1 or 0-5)
  if (range <= 5) {
    return 0.01;
  }
  
  // For medium ranges (5-100)
  if (range <= 100) {
    return 0.1;
  }
  
  // For large ranges
  if (range <= 1000) {
    return 1;
  }
  
  // For very large ranges
  return Math.pow(10, Math.floor(Math.log10(range)) - 2);
}

export default function DropdownCard({ 
  onPatternChange, 
  onLawChange, 
  onControlChange,
  onActiveRangeChange,
  onInactiveRangeChange,
  law, 
  controlVariable,
  availableColumns,
  activeRange,
  inactiveRange,
  columnRanges = {},
  onSubmit,
  constraints = null,
}: DropdownCardProps) {
  const [selectedPattern, setSelectedPattern] = useState<number>(7); // Default pattern number
  const [selectedLaw, setSelectedLaw] = useState<string>(law); // Default law
  const [selectedControl, setSelectedControl] = useState<string>(controlVariable);
  
  // Replace threshold with ranges
  const [activeRangeValue, setActiveRangeValue] = useState<[number, number]>(activeRange || [0, 0.4]);
  const [inactiveRangeValue, setInactiveRangeValue] = useState<[number, number]>(inactiveRange || [0.6, 1.0]);
  
  // Get min, max for the selected law - for sliders
  const getMinMax = (column: string) => {
    const defaultRange = { min: 0, max: 1 };
    if (!column) return defaultRange;
    
    // Use dynamically fetched ranges if available
    if (columnRanges && columnRanges[column]) {
      return columnRanges[column];
    }
    
    // Fallback to default range if no columnRanges provided or column not found
    return defaultRange;
  };
  
  const { min, max } = getMinMax(selectedLaw);
  const step = determineStepSize(min, max);
  
  // Determine if we should show the range sliders
  const showRangeControls = true;

  // Notify parent whenever selectedPattern changes
  useEffect(() => {
    onPatternChange(selectedPattern);
  }, [selectedPattern, onPatternChange]);
  
  // Handle active range changes
  const handleActiveRangeChange = (range: [number, number]) => {
    setActiveRangeValue(range);
    if (onActiveRangeChange) onActiveRangeChange(range, selectedLaw);
  };
  
  // Handle inactive range changes
  const handleInactiveRangeChange = (range: [number, number]) => {
    setInactiveRangeValue(range);
    if (onInactiveRangeChange) onInactiveRangeChange(range, selectedLaw);
  };

  useEffect(() => {
    setSelectedLaw(selectedLaw);
    onLawChange(selectedLaw);
  }, [selectedLaw]);

  useEffect(() => {
    setSelectedLaw(law);
  }, [law]);

  useEffect(() => {
    setSelectedControl(controlVariable);
  }, [controlVariable]);

  useEffect(() => {
    onControlChange(selectedControl);
  }, [selectedControl, onControlChange]);
  
  // Update ranges when the law changes
  useEffect(() => {
    if (selectedLaw) {
      const { min, max } = getMinMax(selectedLaw);
      
      // Set default ranges - active in lower 40%, inactive in upper 40%
      const newActiveRange: [number, number] = [min, min + (max - min) * 0.4];
      const newInactiveRange: [number, number] = [min + (max - min) * 0.6, max];
      
      setActiveRangeValue(newActiveRange);
      setInactiveRangeValue(newInactiveRange);
      
      if (onActiveRangeChange) onActiveRangeChange(newActiveRange, selectedLaw);
      if (onInactiveRangeChange) onInactiveRangeChange(newInactiveRange, selectedLaw);
    }
  }, [selectedLaw]);

  // Update active and inactive ranges when props change
  useEffect(() => {
    if (activeRange) {
      setActiveRangeValue(activeRange);
    }
  }, [activeRange]);

  useEffect(() => {
    if (inactiveRange) {
      setInactiveRangeValue(inactiveRange);
    }
  }, [inactiveRange]);

  // Add handler for Run Analysis button that uses ranges
  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({ 
        constraints: constraints, 
        law: selectedLaw, 
        activeRange: activeRangeValue,
        inactiveRange: inactiveRangeValue
      });
    }
  };

  return (
    <Card>
      {/* Control Variable Selection */}
      <CardHeader className="w-full pb-2">
        <CardTitle>Choose the Outcome Variable</CardTitle>
        {/* <CardDescription>
          Select which variable to use as the Outcome.
        </CardDescription> */}
      </CardHeader>
      <CardContent>
        <Select value={selectedControl} onValueChange={setSelectedControl}>
          <SelectTrigger>
            <SelectValue placeholder="Select control variable" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((column) => (
              <SelectItem key={column} value={column}>
                {column}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>

      {/* Treatment Selection */}
      <CardHeader className="w-full pt-0 pb-2">
        <CardTitle>Choose the Treatment</CardTitle>
        {/* <CardDescription>
          Select a treatment to learn more about its effect.
        </CardDescription> */}
      </CardHeader>
      <CardContent>
        <ComboboxLaw value={selectedLaw} onChange={setSelectedLaw} availableColumns={availableColumns} />
        
        {/* Range Controls - replaces threshold control */}
        {showRangeControls && selectedLaw && (
          <div className="mt-4">
            <ThresholdControl
              min={min}
              max={max}
              step={step}
              activeRange={activeRangeValue}
              inactiveRange={inactiveRangeValue}
              onActiveRangeChange={handleActiveRangeChange}
              onInactiveRangeChange={handleInactiveRangeChange}
            />
          </div>
        )}
      </CardContent>
      
      {/* Pattern Selection */}
      <CardHeader className="w-full pt-0 pb-2">
        <CardTitle>Choose the Pattern</CardTitle>
        {/* <CardDescription>
          Select a pattern that finds abnormalities within this subset of data.
        </CardDescription> */}
      </CardHeader>
      <CardContent>
        <ComboboxPattern value={selectedPattern} onChange={setSelectedPattern} />
      </CardContent>

      {/* Run Analysis Button */}
      {onSubmit && (
        <CardFooter className="pt-0">
          <Button onClick={handleSubmit} variant={"default"} className="w-full">
            Run Analysis
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}