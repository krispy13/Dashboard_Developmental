"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Upload, CheckCircle2, AlertCircle, FileDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UploadStatus = "idle" | "uploading" | "success" | "error"

interface FileUploadProps {
  label: string
  description: string
  accept?: string
  required?: boolean
  onChange: (file: File | null) => void
  status: UploadStatus
  errorMessage?: string
}

function FileUpload({
  label,
  description,
  accept = ".csv",
  required = false,
  onChange,
  status,
  errorMessage,
}: FileUploadProps) {
  const [fileName, setFileName] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      setFileName(file.name)
      onChange(file)
    } else {
      setFileName("")
      onChange(null)
    }
  }

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor={`file-${label}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            id={`file-${label}`}
            type="file"
            accept={accept}
            className="cursor-pointer"
            onChange={handleFileChange}
            disabled={status === "uploading"}
          />
          {status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
        </div>
        {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
        <p className="text-sm text-muted-foreground">{description}</p>
        {status === "error" && errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      </div>
    </div>
  )
}

interface UploadDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDataFileChanged: () => void // Add callback function prop
}

export function UploadDataDialog({
  open,
  onOpenChange,
  onDataFileChanged
}: UploadDataDialogProps) {
  const [step, setStep] = useState<"main" | "pattern" | "existing">("main")
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [patternFile, setPatternFile] = useState<File | null>(null)
  const [mainFileStatus, setMainFileStatus] = useState<UploadStatus>("idle")
  const [patternFileStatus, setPatternFileStatus] = useState<UploadStatus>("idle")
  const [mainFileError, setMainFileError] = useState<string>("")
  const [patternFileError, setPatternFileError] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [existingFiles, setExistingFiles] = useState<string[]>([])
  const [selectedExistingFile, setSelectedExistingFile] = useState<string>("")
  const [isChangingFile, setIsChangingFile] = useState(false)
  const [changeFileStatus, setChangeFileStatus] = useState<UploadStatus>("idle")

  useEffect(() => {
    // Fetch existing CSV files from backend when dialog opens
    if (open) {
      fetchExistingFiles()
    }
  }, [open])

  const fetchExistingFiles = async () => {
    try {
      const response = await fetch("/api/list-files?type=csv")
      if (!response.ok) {
        throw new Error("Failed to fetch file list")
      }
      const data = await response.json()
      setExistingFiles(data.files || [])
    } catch (error) {
      console.error("Error fetching file list:", error)
    }
  }

  const resetState = () => {
    setStep("main")
    setMainFile(null)
    setPatternFile(null)
    setMainFileStatus("idle")
    setPatternFileStatus("idle")
    setMainFileError("")
    setPatternFileError("")
    setIsUploading(false)
    setSelectedExistingFile("")
    setChangeFileStatus("idle")
  }

  const handleMainFileChange = (file: File | null) => {
    setMainFile(file)
    setMainFileStatus("idle")
    setMainFileError("")
  }

  const handlePatternFileChange = (file: File | null) => {
    setPatternFile(file)
    setPatternFileStatus("idle")
    setPatternFileError("")
  }

  const handleNext = () => {
    if (!mainFile) {
      setMainFileError("Please select a main data file")
      return
    }
    setStep("pattern")
  }

  const handleUpload = async () => {
    if (!mainFile) {
      setMainFileError("Please select a main data file")
      return
    }

    setIsUploading(true)

    // Upload main file
    setMainFileStatus("uploading")
    try {
      const mainFormData = new FormData()
      mainFormData.append("file", mainFile)
      mainFormData.append("type", "main")

      const mainResponse = await fetch("/api/upload", {
        method: "POST",
        body: mainFormData,
      })

      if (!mainResponse.ok) {
        throw new Error(`Failed to upload main file: ${mainResponse.statusText}`)
      }

      setMainFileStatus("success")

      // Upload pattern file if provided
      if (patternFile) {
        setPatternFileStatus("uploading")
        const patternFormData = new FormData()
        patternFormData.append("file", patternFile)
        patternFormData.append("type", "pattern")

        const patternResponse = await fetch("/api/upload", {
          method: "POST",
          body: patternFormData,
        })

        if (!patternResponse.ok) {
          throw new Error(`Failed to upload pattern file: ${patternResponse.statusText}`)
        }

        setPatternFileStatus("success")
      }

      // Notify backend to reload data
      await fetch("/api/reload-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mainFile: mainFile.name,
          patternFile: patternFile ? patternFile.name : null,
        }),
      })

      // Close dialog after successful upload
      setTimeout(() => {
        // Call the callback function to refresh data
        onDataFileChanged()
        onOpenChange(false)
        resetState()
      }, 1500)
    } catch (error) {
      console.error("Upload error:", error)
      if (error instanceof Error) {
        if (error.message.includes("main file")) {
          setMainFileStatus("error")
          setMainFileError(error.message)
        } else {
          setPatternFileStatus("error")
          setPatternFileError(error.message)
        }
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleChangeFile = async () => {
    if (!selectedExistingFile) {
      return
    }

    setIsChangingFile(true)
    setChangeFileStatus("uploading")

    try {
      // Notify backend to reload data with the selected file
      const response = await fetch("/api/reload-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mainFile: selectedExistingFile,
          patternFile: null, // Keep patterns the same
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to change file: ${response.statusText}`)
      }

      setChangeFileStatus("success")

      // Close dialog after successful change
      setTimeout(() => {
        // Call the callback function to refresh data
        onDataFileChanged()
        onOpenChange(false)
        resetState()
      }, 1500)
    } catch (error) {
      console.error("Change file error:", error)
      setChangeFileStatus("error")
    } finally {
      setIsChangingFile(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!isUploading && !isChangingFile) {
          onOpenChange(newOpen)
          if (!newOpen) resetState()
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Set Data Files</DialogTitle>
          <DialogDescription>
            Upload new CSV files or choose from existing files for analysis.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={step} onValueChange={(value) => setStep(value as "main" | "pattern" | "existing")} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="main" disabled={isUploading || isChangingFile}>
              Upload New
            </TabsTrigger>
            <TabsTrigger value="pattern" disabled={isUploading || isChangingFile || !mainFile}>
              Pattern File
            </TabsTrigger>
            <TabsTrigger value="existing" disabled={isUploading || isChangingFile}>
              Use Existing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="space-y-4 py-4">
            <FileUpload
              label="Main Data File"
              description="Upload a new CSV data file containing county-level data."
              required
              onChange={handleMainFileChange}
              status={mainFileStatus}
              errorMessage={mainFileError}
            />

            <DialogFooter>
              <Button onClick={handleNext} disabled={!mainFile || isUploading}>
                Next
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="pattern" className="space-y-4 py-4">
            <FileUpload
              label="Pattern File"
              description="Upload an optional pattern CSV file."
              required={false}
              onChange={handlePatternFileChange}
              status={patternFileStatus}
              errorMessage={patternFileError}
            />

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("main")} disabled={isUploading}>
                Back
              </Button>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="existing" className="space-y-4 py-4">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="existing-file">Select Existing CSV File</Label>
              <div className="flex flex-col gap-2">
                <Select
                  value={selectedExistingFile}
                  onValueChange={setSelectedExistingFile}
                  disabled={isChangingFile}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a CSV file" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingFiles.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose from existing CSV files in the data folder to use for analysis.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                onClick={handleChangeFile}
                disabled={!selectedExistingFile || isChangingFile}
              >
                {isChangingFile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Use Selected File
                  </>
                )}
              </Button>
            </DialogFooter>
            
            {changeFileStatus === "success" && (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>Successfully changed to selected file</span>
              </div>
            )}
            
            {changeFileStatus === "error" && (
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>Failed to change file. Please try again.</span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
