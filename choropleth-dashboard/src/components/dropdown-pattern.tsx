// ComboboxPattern.tsx

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Define the type for pattern values
interface Pattern {
  value: number
  label: string
}

// Dynamically generate patterns from 1 to 76
// const patterns: Pattern[] = Array.from({ length: 76 }, (_, index) => ({
//   value: index + 1,
//   label: `Pattern ${index + 1}`,
// }))

// Pre-Existing Patterns
const patterns: Pattern[] = [
  { value: 1, label: 'Charge Protection under Parole' },
  { value: 2, label: 'Prosecution Protection under Parole' },
  { value: 3, label: 'High Youth Population with Economic Risk' },
  { value: 4, label: 'High Youth Population, Low Education Level' },
  { value: 5, label: 'High Youth Population, Limited Good Samaritan Law Coverage' },
  { value: 6, label: 'High Youth Population, Low White Population' },
  { value: 7, label: 'Low Mining Employment, Specific Native American Demographics, High Medical Density' },
  { value: 8, label: 'Low Mining Employment, Specific Native American Demographics, Mental Health Facility Presence' },
  { value: 9, label: 'Low Black Population, No Substance Use Facilities' },
  { value: 10, label: 'Low Black Population, No Mental Health Facilities' },
  { value: 11, label: 'Low Mining Employment, Charge Protection under Controlled Substances Good Samaritan Law' },
  { value: 12, label: 'Low Black Population, Limited Good Samaritan Law Coverage' },
  { value: 13, label: 'Low Black Population, Limited Medical Professionals' },
  { value: 14, label: 'Low Mining Employment, Parole Protection under Good Samaritan Law, Substance Use Facility Presence' },
  { value: 15, label: 'Low Mining Employment, High Medical Density, Mental Health Facility Presence' },
  { value: 16, label: 'High Youth Population' },
  { value: 17, label: 'High Medical Density with Charge Protection and Substance Use Facilities' },
  { value: 18, label: 'Low Mining Employment with High Medical Density and Moderate Unemployment' },
  { value: 19, label: 'High Medical Density with Charge Protection and Working-Age Population' },
  { value: 20, label: 'Low Mining Employment with Small Native American/Alaska Native Population' },
  { value: 21, label: 'Low Mining Employment with Charge Protection and Moderate Black Population' },
  { value: 22, label: 'High Medical Density in Urban Areas' },
  { value: 23, label: 'Low Mining Employment with Parole Protection' },
  { value: 24, label: 'Low Mining Employment with Mental Health Facilities and Legal Protection' },
  { value: 25, label: 'Low Mining Employment with High Medical Density' },
  { value: 26, label: 'Low Mining Employment in Urban Areas with Legal Protection' },
  { value: 27, label: 'Low Mining Employment with Charge Protection' },
  { value: 28, label: 'Low Mining Employment with Substance Use Facilities and Legal Protection' },
  { value: 29, label: 'High Medical Density with Charge Protection' },
  { value: 30, label: 'Low Mining Employment with Prosecution Protection and Moderate Black Population' },
  { value: 31, label: 'Low Black Population' },
  { value: 32, label: 'Low Mining Employment with Mental Health Facilities' },
  { value: 33, label: 'High Medical Density with Substance Use Facilities and Legal Protection' },
  { value: 34, label: 'Low Mining Employment in Urban Areas' },
  { value: 35, label: 'Mental Health Facilities with Charge Protection' },
  { value: 36, label: 'High Medical Density with a Working-Age Population and Moderate Unemployment' },
  { value: 37, label: 'Low Mining Employment with Legal Protection and High Trade-Transport Employment' },
  { value: 38, label: 'Low Mining Employment with Legal Protection and Moderate Black Population' },
  { value: 39, label: 'High Medical Density with Mental Health Facilities' },
  { value: 40, label: 'Low Mining Employment with Legal Protection and Moderate Unemployment' },
  { value: 41, label: 'Low Mining Employment with Substance Use Facilities' },
  { value: 42, label: 'Low Mining Employment with Prosecution Protection' },
  { value: 43, label: 'Low Unemployment Rate' },
  { value: 44, label: 'High Medical Density with Substance Use Facilities' },
  { value: 45, label: 'High Medical Density with a Large Working-Age Population' },
  { value: 46, label: 'Low Mining Employment with Legal Protection' },
  { value: 47, label: 'Low Mining Employment with Black Population Constraints' },
  { value: 48, label: 'Low Mining Employment with Moderate Unemployment Rate' },
  { value: 49, label: 'Low Mining Employment with High Trade-Transportation Employment' },
  { value: 50, label: 'High Medical Density with Black Population Constraints' },
  { value: 51, label: 'High Medical Density with Legal Protection' },
  { value: 52, label: 'High Medical Density with Moderate Unemployment Rate' },
  { value: 53, label: 'Mental Health Facilities with Legal Protection' },
  { value: 54, label: 'No Substance Use Facilities' },
  { value: 55, label: 'Substance Use Facilities with Legal Protection - Prosecution' },
  { value: 56, label: 'Low Mining Employment' },
  { value: 57, label: 'Mental Health Facilities with Unemployment Rate Constraints' },
  { value: 58, label: 'Substance Use Facilities with Legal Protection - Charge' },
  { value: 59, label: 'Low Medical Density' },
  { value: 60, label: 'Mental Health Facilities with Low Youth Population' },
  { value: 61, label: 'Low Legal Protection' },
  { value: 62, label: 'High Medical Density' },
  { value: 63, label: 'Substance Use Facilities with Unemployment Rate Constraints' },
  { value: 64, label: 'Mental Health Facilities' },
  { value: 65, label: 'Substance Use Facilities with Youth Population Constraints' },
  { value: 66, label: 'Substance Use Facilities' },
  { value: 67, label: 'Legal Protection and Low Black Population' },
  { value: 68, label: 'High Employment in Mining and Natural Resources' },
  { value: 69, label: 'Limited Substance Use Facilities' },
  { value: 70, label: 'Legal Protection' },
  { value: 71, label: 'Low Unemployment Rates' },
  { value: 72, label: 'Low Black Population 2' },
  { value: 73, label: 'Limited Mental Health Facilities' },
  { value: 74, label: 'Low Youth Population' },
  { value: 75, label: 'No Legal Protection from Charge' },
  { value: 76, label: 'No Legal Protection from Prosecution' }
];


// Define the props interface
interface ComboboxPatternProps {
  value: number
  onChange: (value: number) => void
}

export function ComboboxPattern({ value, onChange }: ComboboxPatternProps) {
  const [open, setOpen] = React.useState(false)

  // Find the label based on the current value
  const selectedPattern = patterns.find((pattern) => pattern.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-[200px] min-h-[40px] w-auto h-auto whitespace-normal break-words justify-start"
        >
          {selectedPattern ? selectedPattern.label : "Select pattern..."}
          <ChevronsUpDown className="opacity-50 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Command>
          <CommandInput placeholder="Search pattern..." />
          <CommandList>
            <CommandEmpty>No patterns found.</CommandEmpty>
            <CommandGroup>
              {patterns.map((pattern) => (
                <CommandItem
                  key={pattern.value}
                  value={pattern.value.toString()}
                  onSelect={(currentValue) => {
                    const selectedValue = parseInt(currentValue, 10)
                    onChange(selectedValue)
                    setOpen(false)
                  }}
                >
                  {pattern.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === pattern.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
