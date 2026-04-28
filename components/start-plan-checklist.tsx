"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { CalendarCheck, RotateCcw } from "lucide-react"

export interface StartPlanItem {
  day: string
  goal: string
}

interface StartPlanChecklistProps {
  items: StartPlanItem[]
  title?: string
  storageKey?: string
}

export function StartPlanChecklist({ items, title = "Start Plan", storageKey }: StartPlanChecklistProps) {
  const key = storageKey || `start-plan-${items.map((item) => `${item.day}:${item.goal}`).join("|")}`
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      return JSON.parse(window.localStorage.getItem(key) || "{}")
    } catch {
      return {}
    }
  })

  const completed = useMemo(
    () => items.reduce((count, _item, index) => count + (checked[index] ? 1 : 0), 0),
    [items, checked],
  )

  const updateChecked = (index: number, value: boolean) => {
    const next = { ...checked, [index]: value }
    setChecked(next)
    window.localStorage.setItem(key, JSON.stringify(next))
  }

  const reset = () => {
    setChecked({})
    window.localStorage.removeItem(key)
  }

  if (!items.length) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <Badge variant="secondary">{completed}/{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <label
            key={`${item.day}-${index}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/40"
          >
            <Checkbox
              checked={checked[index] || false}
              onCheckedChange={(value) => updateChecked(index, value === true)}
              className="mt-0.5"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-primary">{item.day}</span>
              <span className={checked[index] ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
                {item.goal}
              </span>
            </span>
          </label>
        ))}
        {completed > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="w-full gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset checklist
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
