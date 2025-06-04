"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CustomDualRangeSlider } from "@/components/custom-sliders"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SliderConfig {
  name: string
  min: number
  max: number
  step: number
  defaultValue: [number, number]
}

interface Constraint {
  [key: string]: {
    lb: number
    ub: number
  }
}

interface MultiSliderProps {
  title: string;
  description: string;
  sliders: SliderConfig[];
  onSliderChange: (newPattern: { sliders: SliderConfig[]; constraints: Constraint | null }) => void;
  availableColumns: string[];
  columnRanges?: {[key: string]: {min: number, max: number}};
}

// const availableVariables = [
//   "Percent-of-Population-Under-15-(2013-2017)",
//   "Percent-of-Population-Aged-15-to-64-(2013-2017)",
//   "Percent-of-Population-65+-(2013-2017)",
//   "Percent-of-Population-White-(non-Hispanic)-(2013-2017)",
//   "Percent-of-Populaiton-Black-(non-Hispanic)-(2013-2017)",
//   "Percent-of-Population-Hispanic-or-Latino-(2013-2017)",
//   "Percent-of-Population-Asian-(non-Hispanic)-(2013-2017)",
//   "Percent-of-Population-Native-American/Alaska-Native-(non-Hispanic)-(2013-2017)",
//   "Percent-of-Population-Native-Hawaiian/Pacific-Islander-(2013-2017)",
//   "Percent-of-Population-Aged-25+-who-Have-at-Least-a-High-School-Diploma-(2013-2017)",
//   "Percent-of-Population-Aged-25+-who-Have-a-Bachelor's-Degree-or-More-(2013-2017)",
//   "Poverty-Rate-(2013-2017)",
//   "Median-Household-Income-(2013-2017)",
//   "Unemployment-Rate-(2013-2017)",
//   "Percent-of-Residents-with-a-Disability-(Aged-18-64)-(2013-2017)",
//   "Percent-of-Popualtion-Employed-in-Mining-and-Natural-Resources-(2013-2017)",
//   "Percent-of-Popualtion-Employed-in-Construction-(2013-2017)",
//   "Percent-of-Popualtion-Employed-in-Trade-Transportation-and-Utilities-(2013-2017)",
//   "Number-of-Substance-Use-Facilities-(As-of-March-2023)",
//   "Number-of-Mental-Health-Facilities-(As-of-March-2023)",
//   "MDsPerCapita",
//   "Urbanicity",
//   "Social-Resilience-Score",
//   "Economic-Risk-Score",
//   "Social-Risk-Score",
//   "Economic-Resilience-Score",
//   "Prosperity-Index-Score"
// ]

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


export default function MultiSliderDashboard({ title, description, sliders, onSliderChange, availableColumns, columnRanges = {} }: MultiSliderProps) {
  const [values, setValues] = useState<[number, number][]>(sliders.map((slider) => slider.defaultValue))
  const [localSliders, setLocalSliders] = useState<SliderConfig[]>(sliders)
  // const [localConstraints, setConstraints] = useState<Constraint | null>(null)
  const [selectedVariable, setSelectedVariable] = useState<string>("")

  // Extract constraints from sliders
  const extractConstraints = (sliders: SliderConfig[]): Constraint => {
    return sliders.reduce((acc, slider) => {
      acc[slider.name] = { lb: slider.defaultValue[0], ub: slider.defaultValue[1] }
      return acc
    }, {} as Constraint)
  }

  // Update values when sliders prop changes
  useEffect(() => {
    setValues(sliders.map((slider) => slider.defaultValue))
    setLocalSliders(sliders)
    // setConstraints(extractConstraints(sliders))
  }, [sliders])

  // This function is called continuously during dragging
  const handleSliderChange = (index: number, newValue: number[]) => {
    // Update local state for visual feedback during dragging
    const updatedValues = [...values]
    if (newValue.length === 2) {
      updatedValues[index] = [newValue[0], newValue[1]]
    }
    setValues(updatedValues)
    
    // Update slider defaultValue for next render
    const updatedSliders = [...localSliders]
    if (newValue.length === 2) {
      updatedSliders[index].defaultValue = [newValue[0], newValue[1]]
    }
    setLocalSliders(updatedSliders)
  }

  // This function is called only when dragging ends (onValueCommit)
  const handleSliderCommit = (index: number, newValue: number[]) => {
    const updatedSliders = [...localSliders]
    if (newValue.length === 2) {
      updatedSliders[index].defaultValue = [newValue[0], newValue[1]]
    }
    setLocalSliders(updatedSliders)
    updateConstraintsAndNotify(updatedSliders)
  }

  const handleInputChange = (index: number, position: 0 | 1, inputValue: string) => {
    if (inputValue === "") {
      // Allow empty input
      const updatedValues = [...values]
      updatedValues[index][position] = Number.NaN
      setValues(updatedValues)
      return
    }

    const numValue = Number.parseFloat(inputValue)
    if (!isNaN(numValue)) {
      const updatedValues = [...values]
      const slider = localSliders[index]
      const clampedValue = Math.min(Math.max(numValue, slider.min), slider.max)

      if (position === 0) {
        updatedValues[index] = [clampedValue, Math.max(clampedValue, updatedValues[index][1])]
      } else {
        updatedValues[index] = [Math.min(clampedValue, updatedValues[index][0]), clampedValue]
      }
      setValues(updatedValues)
      const updatedSliders = [...localSliders]
      updatedSliders[index].defaultValue = updatedValues[index]
      setLocalSliders(updatedSliders)
      
      // Input changes should immediately update constraints
      updateConstraintsAndNotify(updatedSliders)
    }
  }

  const addSlider = () => {
    if (selectedVariable) {

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
    
    const { min, max } = getMinMax(selectedVariable);
    const step = determineStepSize(min, max);
  
      
      // Calculate default values at 25% and 75% of the range
      const rangeSize = max - min;
      const defaultLow = min + (rangeSize * 0.10);
      const defaultHigh = min + (rangeSize * 0.60);


      const newSlider: SliderConfig = {
        name: selectedVariable,
        min: min,
        max: max,
        step: step,
        defaultValue: [defaultLow, defaultHigh],
      }
      const updatedSliders = [...localSliders, newSlider]
      setLocalSliders(updatedSliders)
      setValues([...values, newSlider.defaultValue])
      updateConstraintsAndNotify(updatedSliders)
      setSelectedVariable("") // Reset selected variable
    }
  }

  const deleteSlider = (index: number) => {
    const updatedSliders = localSliders.filter((_, i) => i !== index)
    setLocalSliders(updatedSliders)
    setValues(values.filter((_, i) => i !== index))
    updateConstraintsAndNotify(updatedSliders)
  }

  const updateConstraintsAndNotify = (updatedSliders: SliderConfig[]) => {
    const newConstraints = extractConstraints(updatedSliders)
    // setConstraints(newConstraints)
    onSliderChange({ sliders: updatedSliders, constraints: newConstraints })
  }

  return (
    <Card className="w-full max-h-[45vh]">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ScrollArea className="h-[27vh] pr-4">
            {localSliders.map((slider, index) => (
              <div key={slider.name} className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <Label>{slider.name}</Label>
                  <Button variant="ghost" size="icon" onClick={() => deleteSlider(index)} className="h-8 w-8 p-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CustomDualRangeSlider
                  defaultValue={slider.defaultValue}
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={values[index]}
                  onValueChange={(newValue) => handleSliderChange(index, newValue)}
                  onValueCommit={(newValue) => handleSliderCommit(index, newValue)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{slider.min.toFixed(2)}</span>
                  <span>{slider.max.toFixed(2)}</span>
                </div>
                <div className="flex justify-left items-center space-x-2">
                  <Input
                    type="number"
                    value={isNaN(values[index][0]) ? "" : values[index][0]}
                    onChange={(e) => handleInputChange(index, 0, e.target.value)}
                    // pattern="[0-9]*\.?[0-9]*"
                    min={slider.min}
                    max={slider.max}
                    step={0.01}
                    className="w-20 text-center h-8"
                    style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
                  />
                  <div className="text-sm">to</div>
                  <Input
                    type="number"
                    value={isNaN(values[index][1]) ? "" : values[index][1]}
                    onChange={(e) => handleInputChange(index, 1, e.target.value)}
                    // pattern="[0-9]*\.?[0-9]*"
                    min={slider.min}
                    max={slider.max}
                    step={0.01}
                    className="w-20 text-center h-8"
                    style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
                  />
                </div>
              </div>
            ))}
          </ScrollArea>
          <div className="space-y-2 pt-2 border-t">
            <Select value={selectedVariable} onValueChange={setSelectedVariable}>
              <SelectTrigger>
                <SelectValue placeholder="Select a condition" />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((variable) => (
                  <SelectItem key={variable} value={variable}>
                    {variable}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addSlider} className="w-full" disabled={!selectedVariable}>
              <Plus className="mr-2 h-4 w-4" /> Add Slider
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}