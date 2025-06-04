"use client"

import { useState, useEffect } from "react"
import { CustomDualRangeSlider } from "@/components/custom-sliders" // Change to dual range slider
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ThresholdControlProps {
  min: number
  max: number
  step: number
  activeRange: [number, number] // Change from single value to range
  inactiveRange: [number, number] // Add inactive range
  onActiveRangeChange: (range: [number, number]) => void // Update callback
  onInactiveRangeChange: (range: [number, number]) => void // Add callback for inactive
  disabled?: boolean
}

export function ThresholdControl({
  min,
  max,
  step,
  activeRange,
  inactiveRange,
  onActiveRangeChange,
  onInactiveRangeChange,
  disabled = false
}: ThresholdControlProps) {
  const [localActiveRange, setLocalActiveRange] = useState<[number, number]>(activeRange)
  const [localInactiveRange, setLocalInactiveRange] = useState<[number, number]>(inactiveRange)

  useEffect(() => {
    setLocalActiveRange(activeRange)
  }, [activeRange])

  useEffect(() => {
    setLocalInactiveRange(inactiveRange)
  }, [inactiveRange])

  const handleActiveSliderChange = (newValue: number[]) => {
    if (newValue.length === 2) {
      const typedValue: [number, number] = [newValue[0], newValue[1]]
      setLocalActiveRange(typedValue)
      onActiveRangeChange(typedValue)
    }
  }

  const handleInactiveSliderChange = (newValue: number[]) => {
    if (newValue.length === 2) {
      const typedValue: [number, number] = [newValue[0], newValue[1]]
      setLocalInactiveRange(typedValue)
      onInactiveRangeChange(typedValue)
    }
  }

  const handleActiveInputChange = (index: 0 | 1, inputValue: string) => {
    if (inputValue === "") return;

    const numValue = Number(inputValue)
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(Math.max(numValue, min), max)
      const newRange = [...localActiveRange] as [number, number]
      
      if (index === 0) {
        newRange[0] = Math.min(clampedValue, newRange[1])
      } else {
        newRange[1] = Math.max(clampedValue, newRange[0]) 
      }
      
      setLocalActiveRange(newRange)
      onActiveRangeChange(newRange)
    }
  }

  const handleInactiveInputChange = (index: 0 | 1, inputValue: string) => {
    if (inputValue === "") return;

    const numValue = Number(inputValue)
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(Math.max(numValue, min), max)
      const newRange = [...localInactiveRange] as [number, number]
      
      if (index === 0) {
        newRange[0] = Math.min(clampedValue, newRange[1])
      } else {
        newRange[1] = Math.max(clampedValue, newRange[0]) 
      }
      
      setLocalInactiveRange(newRange)
      onInactiveRangeChange(newRange)
    }
  }

  return (
    <div className="mt-0">
      {/* Active Range Control */}
      <div className="space-y-2">
        <Label>Active Range</Label>
        <CustomDualRangeSlider
          min={min}
          max={max}
          step={step}
          value={localActiveRange}
          onValueChange={handleActiveSliderChange}
          disabled={disabled}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min.toFixed(2)}</span>
          <span>{max.toFixed(2)}</span>
        </div>
      </div>

      {/* Inactive Range Control */}
      <div className="space-y-2">
        <Label>Inactive Range</Label>
        <CustomDualRangeSlider
          min={min}
          max={max}
          step={step}
          value={localInactiveRange}
          onValueChange={handleInactiveSliderChange}
          disabled={disabled}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min.toFixed(2)}</span>
          <span>{max.toFixed(2)}</span>
        </div>
        <div className="flex flex-row justify-start items-center space-x-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsla(25, 95%, 55%, 0.8)" }}></div>
          <span>Active: </span>
          <div className="flex justify-left items-center space-x-2">
            <Input
              type="number"
              value={localActiveRange[0]}
              onChange={(e) => handleActiveInputChange(0, e.target.value)}
              min={min}
              max={max}
              step={step}
              className="w-20 text-center h-8"
              style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
              disabled={disabled}
            />
            <div className="text-sm">to</div>
            <Input
              type="number"
              value={localActiveRange[1]}
              onChange={(e) => handleActiveInputChange(1, e.target.value)}
              min={min}
              max={max}
              step={step}
              className="w-20 text-center h-8"
              style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
              disabled={disabled}
            />
          </div>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsla(217, 91%, 60%, 0.8)" }}></div>
          <span>Inactive: </span>
          <div className="flex justify-left items-center space-x-2">
            <Input
              type="number"
              value={localInactiveRange[0]}
              onChange={(e) => handleInactiveInputChange(0, e.target.value)}
              min={min}
              max={max}
              step={step}
              className="w-20 text-center h-8"
              style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
              disabled={disabled}
            />
            <div className="text-sm">to</div>
            <Input
              type="number"
              value={localInactiveRange[1]}
              onChange={(e) => handleInactiveInputChange(1, e.target.value)}
              min={min}
              max={max}
              step={step}
              className="w-20 text-center h-8"
              style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
              disabled={disabled}
            />
          </div>
        </div>
        
      </div>
    </div>
  )
}