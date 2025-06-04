"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

interface CustomDualRangeSliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  onValueCommit?: (values: number[]) => void; // New callback for when dragging ends
}

const CustomDualRangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  CustomDualRangeSliderProps
>(({ className, onValueCommit, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
    // Add onValueCommit handler when user releases the slider
    onValueCommit={(value) => {
      if (onValueCommit) {
        onValueCommit(value);
      }
    }}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
      {[...Array(11)].map((_, i) => (
        <div
          key={i}
          className="absolute top-0 h-full w-px bg-secondary-foreground/20"
          style={{ left: `${i * 10}%` }}
        />
      ))}
    </SliderPrimitive.Track>
    {[0, 1].map((index) => (
      <SliderPrimitive.Thumb
        key={index}
        className="block h-5 w-1.5 rounded-sm bg-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      />
    ))}
  </SliderPrimitive.Root>
))
CustomDualRangeSlider.displayName = SliderPrimitive.Root.displayName

export { CustomDualRangeSlider }

