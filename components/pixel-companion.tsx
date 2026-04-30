"use client"

import { cn } from "@/lib/utils"

const companionPixels = [
  "....4444....",
  "...466664...",
  "..46666664..",
  ".4666666664.",
  ".6661161166.",
  "466611611664",
  "466666666664",
  ".6662222666.",
  "..66444466..",
  "...633336...",
  "..333..333..",
  ".333....333.",
]

const colorMap: Record<string, string> = {
  "1": "bg-slate-950",
  "2": "bg-sky-200",
  "3": "bg-primary",
  "4": "bg-indigo-300",
  "6": "bg-indigo-500",
}

interface PixelCompanionProps {
  className?: string
}

export function PixelCompanion({ className }: PixelCompanionProps) {
  return (
    <div className={cn("relative h-64 w-64", className)}>
      <div className="absolute inset-6 rounded-full bg-primary/10 blur-2xl" />
      <div className="absolute inset-x-8 bottom-9 h-8 rounded-full bg-slate-950/10 blur-md" />
      <div className="relative mx-auto grid w-48 grid-cols-12 gap-0 pt-6 [image-rendering:pixelated]">
        {companionPixels.flatMap((row, rowIndex) =>
          row.split("").map((pixel, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn("aspect-square", colorMap[pixel] || "bg-transparent")}
            />
          ))
        )}
      </div>
      <div className="absolute left-1/2 top-44 h-8 w-32 -translate-x-1/2 border-4 border-slate-950 bg-sky-200" />
      <div className="absolute left-[72px] top-[178px] h-3 w-3 bg-slate-950" />
      <div className="absolute right-[72px] top-[178px] h-3 w-3 bg-slate-950" />
    </div>
  )
}
