import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

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

// Define the type for law values
interface Law {
  value: string
  label: string
}

// Define the props interface
interface ComboboxLawProps {
  value: string
  onChange: (value: string) => void
  availableColumns: string[] // Pass available columns from parent
}

export function ComboboxLaw({ value, onChange, availableColumns }: ComboboxLawProps) {
  const [open, setOpen] = React.useState(false)
  const [laws, setLaws] = React.useState<Law[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    // Process available columns to extract law-related columns
    if (availableColumns.length > 0) {
      setIsLoading(true)
      
      // Filter columns that are likely to be laws (columns after index 28)
      // Assumption: The first 28 columns are non-law related
      // const lawColumns = availableColumns.slice(28)
      
      // Transform the column names into law options
      const lawOptions: Law[] = availableColumns.map(column => ({
        value: column,
        label: formatLawLabel(column)
      }))
      
      setLaws(lawOptions)
      setIsLoading(false)
      
      // If current value is not in the laws list, reset it
      if (value && lawOptions.length > 0 && !lawOptions.some(law => law.value === value)) {
        onChange(lawOptions[0].value)
      }
    }
  }, [availableColumns, value, onChange])

  // Format law label to be more readable
  const formatLawLabel = (lawName: string): string => {
    // Replace hyphens with spaces
    let formattedName = lawName.replace(/-/g, ' ')
    
    // Make first letter of each word uppercase
    formattedName = formattedName
      .split('_')
      .map(part => {
        return part.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      })
      .join(' - ')
    
    return formattedName
  }

  // Find the label based on the current value
  const selectedLaw = laws.find((law) => law.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-[290px] min-h-[40px] w-auto h-auto whitespace-normal break-words justify-start"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading treatments...
            </>
          ) : selectedLaw ? (
            selectedLaw.label
          ) : (
            "Select Treatment..."
          )}
          <ChevronsUpDown className="ml-auto opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[290px] p-0">
        <Command>
          <CommandInput placeholder="Search Treatment..." />
          <CommandList>
            <CommandEmpty>No treatments found.</CommandEmpty>
            <CommandGroup>
              {laws.map((law) => (
                <CommandItem
                  key={law.value}
                  value={law.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue)
                    setOpen(false)
                  }}
                >
                  {law.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === law.value ? "opacity-100" : "opacity-0"
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
