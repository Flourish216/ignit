"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface IdeaInputProps {
  className?: string
  placeholder?: string
  showExamples?: boolean
}

const exampleIdeas = [
  "Build a mobile app that helps people learn a new language through daily conversations",
  "Create a platform for local artists to showcase and sell their work",
  "Design a tool that helps remote teams stay connected through virtual coffee chats",
]

export function IdeaInput({ className, placeholder, showExamples = true }: IdeaInputProps) {
  const [idea, setIdea] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
            placeholder={placeholder || "Describe your project idea in one sentence..."}
            className="min-h-[120px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI will break down your idea and suggest team roles</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!idea.trim() || isLoading}
              size="sm"
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  Start Building
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {showExamples && (
        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">Try an example:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleIdeas.map((example, index) => (
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
