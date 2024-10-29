"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getTotalPages } from "@/utils/db/db-documents"
import { getDB } from "@/utils/db/db-helper"

type ExcludedItem = {
  start: number
  end: number
}

export default function PageExcluder() {
  const [totalPages, setTotalPages] = useState<number>(0)
  const [excludedItems, setExcludedItems] = useState<ExcludedItem[]>([])
  const [newInput, setNewInput] = useState("")
  const [inputType, setInputType] = useState<"single" | "range">("single")
  const [error, setError] = useState<string | null>(null)

  const db = useRef<any>(null);

  useEffect(() => {
    const getTotal = async () => {
      db.current = await getDB();
      if (db.current) {
        const totalPages = await getTotalPages(db.current);
        setTotalPages(totalPages);
      }
    }
    getTotal();
  }, []);

  const addExcludedItem = () => {
    setError(null)
    let newItem: ExcludedItem | null = null;

    if (inputType === "single") {
      const page = parseInt(newInput.trim(), 10)
      if (!isNaN(page) && page > 0 && page <= totalPages) {
        newItem = { start: page, end: page }
      } else {
        setError(`Please enter a valid page number between 1 and ${totalPages}`)
      }
    } else {
      const range = newInput.split("-").map(num => parseInt(num.trim(), 10))
      if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1]) && range[0] <= range[1] && range[0] > 0 && range[1] <= totalPages) {
        newItem = { start: range[0], end: range[1] }
      } else {
        setError(`Please enter a valid range between 1 and ${totalPages}`)
      }
    }

    if (newItem) {
      setExcludedItems(prevItems => {
        const updatedItems = [...prevItems, newItem!]
        return updatedItems.sort((a, b) => a.start - b.start)
      })
      setNewInput("")
    }
  }

  const removeExcludedItem = (itemToRemove: ExcludedItem) => {
    setExcludedItems(prevItems => 
      prevItems.filter(item => item.start !== itemToRemove.start || item.end !== itemToRemove.end)
    )
  }

  const getTotalExcludedPages = () => {
    return excludedItems.reduce((total, item) => total + (item.end - item.start + 1), 0)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Exclude pages</CardTitle>
        <CardDescription>Exclude specific pages or ranges from your document</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="totalPages" className="block text-sm font-medium">
              Total pages in the document
            </Label>
            <Input
              id="totalPages"
              type="number"
              value={totalPages || ""}
              onChange={(e) => setTotalPages(parseInt(e.target.value, 10) || 0)}
              placeholder="Enter total pages"
              className="mt-1"
            />
          </div>
          <RadioGroup defaultValue="single" onValueChange={(value) => setInputType(value as "single" | "range")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single">Single Page</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="range" id="range" />
              <Label htmlFor="range">Page Range</Label>
            </div>
          </RadioGroup>
          <div>
            <Label htmlFor="excludeInput" className="block text-sm font-medium">
              {inputType === "single" ? "Exclude Page" : "Exclude Page Range"}
            </Label>
            <div className="flex mt-1">
              <Input
                id="excludeInput"
                type="text"
                value={newInput}
                onChange={(e) => setNewInput(e.target.value)}
                placeholder={inputType === "single" ? "e.g., 5" : "e.g., 1-5"}
                className="flex-grow"
              />
              <Button onClick={addExcludedItem} className="ml-2" disabled={totalPages === 0}>
                Add
              </Button>
            </div>
            <p className="mt-1 text-sm">
              {inputType === "single" 
                ? `Enter a single page number (1-${totalPages})` 
                : `Enter a range like '1-5' (max ${totalPages})`}
            </p>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
          </div>
          <div>
            <h3 className="text-sm font-medium">Excluded pages and ranges</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {excludedItems.map((item, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {item.start === item.end ? item.start : `${item.start}-${item.end}`}
                  <button
                    onClick={() => removeExcludedItem(item)}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                    aria-label={`Remove ${item.start === item.end ? `page ${item.start}` : `range ${item.start}-${item.end}`}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-gray-500">
          {excludedItems.length > 0
            ? `Excluding ${getTotalExcludedPages()} page${getTotalExcludedPages() > 1 ? "s" : ""} out of ${totalPages} total pages`
            : "No pages excluded"}
        </p>
      </CardFooter>
    </Card>
  )
}