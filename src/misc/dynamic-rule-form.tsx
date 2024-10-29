'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"

const ruleTypes = [
  { value: "is", label: "Is" },
  { value: "isNot", label: "Is not" },
  { value: "contains", label: "Contains" },
  { value: "doesNotContain", label: "Does not contain" },
]

export default function DynamicRuleForm() {
  const [rules, setRules] = useState<{ type: string, value: string }[]>([])
  const [open, setOpen] = useState(false)

  const addRule = () => {
    setRules([...rules, { type: '', value: '' }])
  }

  const updateRule = (index: number, field: string, value: string) => {
    const updatedRules = [...rules]
    updatedRules[index][field] = value
    setRules(updatedRules)
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Dynamic Rule Form</h2>
      <form className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index} className="flex items-center space-x-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[200px] justify-between"
                >
                  {rule.type
                    ? ruleTypes.find((ruleType) => ruleType.value === rule.type)?.label
                    : "Select rule type..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search rule type..." />
                  <CommandEmpty>No rule type found.</CommandEmpty>
                  <CommandGroup>
                    {ruleTypes.map((ruleType) => (
                      <CommandItem
                        key={ruleType.value}
                        onSelect={() => {
                          updateRule(index, 'type', ruleType.value)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            rule.type === ruleType.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {ruleType.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              type="text"
              placeholder="Enter rule value"
              value={rule.value}
              onChange={(e) => updateRule(index, 'value', e.target.value)}
              className="flex-grow"
            />
          </div>
        ))}
        <Button type="button" onClick={addRule}>Add Rule</Button>
      </form>
    </div>
  )
}