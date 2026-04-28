"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"

interface IdeaInputProps {
  className?: string
  placeholder?: string
  showExamples?: boolean
}

export function IdeaInput({ className, placeholder, showExamples = true }: IdeaInputProps) {
  const [idea, setIdea] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  const handleSubmit = async () => {
    if (!idea.trim()) return
    setIsLoading(true)
    // Navigate to create page with the idea as a query param
    router.push(`/create?idea=${encodeURIComponent(idea)}`)
  }

  const handleExampleClick = (example: string) => {
    setIdea(example)
  }

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <div className="relative">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-lg" />
        <div className="relative rounded-xl border border-border bg-card p-1 shadow-lg">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={placeholder || t.ideaInput.placeholder}
            className="min-h-[120px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <div className="flex flex-col gap-3 border-t border-border/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t.ideaInput.helper}</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!idea.trim() || isLoading}
              size="sm"
              className="w-full gap-2 sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.ideaInput.processing}
                </>
              ) : (
                <>
                  {t.ideaInput.submit}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {showExamples && (
        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">{t.ideaInput.examplesTitle}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {t.ideaInput.examples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {example.length > 50 ? `${example.slice(0, 50)}...` : example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
