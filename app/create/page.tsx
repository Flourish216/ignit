"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { IdeaInput } from "@/components/idea-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, CheckCircle, Users, Target, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"

interface ProjectBreakdown {
  title: string
  description: string
  milestones: Array<{
    name: string
    description: string
    timeframe: string
  }>
  roles: Array<{
    title: string
    skills: string[]
    description: string
  }>
  challenges: Array<{
    challenge: string
    solution: string
  }>
}

function CreateProjectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  
  const initialIdea = searchParams.get("idea") || ""
  const [idea, setIdea] = useState(initialIdea)
  const [breakdown, setBreakdown] = useState<ProjectBreakdown | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  })

  useEffect(() => {
    if (initialIdea && user && !breakdown && !isAnalyzing) {
      analyzeIdea(initialIdea)
    }
  }, [initialIdea, user])

  const analyzeIdea = async (ideaText: string) => {
    if (!user) {
      router.push("/auth/login?redirect=/create")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setStreamingText("")
    setBreakdown(null)

    try {
      const response = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: ideaText }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze idea")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")
          
          for (const line of lines) {
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2))
                fullText += text
                setStreamingText(fullText)
              } catch {
                // Skip non-JSON lines
              }
            }
          }
        }
      }

      // Parse the final JSON
      const jsonMatch = fullText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setBreakdown(parsed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCreateProject = async () => {
    if (!user || !breakdown) return

    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: breakdown.title,
          description: breakdown.description,
          original_idea: idea,
          ai_breakdown: breakdown,
          required_roles: breakdown.roles.map((r) => r.title),
          status: "recruiting",
          owner_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      // Create a team for this project
      await supabase.from("teams").insert({
        project_id: data.id,
        name: `${breakdown.title} Team`,
      })

      router.push(`/project/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setIsCreating(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Card className="text-center">
            <CardContent className="py-12">
              <h2 className="text-2xl font-bold text-foreground">Sign in to create a project</h2>
              <p className="mt-2 text-muted-foreground">
                You need to be signed in to create and manage projects.
              </p>
              <Button asChild className="mt-6">
                <a href="/auth/login?redirect=/create">Sign In</a>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create a New Project</h1>
          <p className="mt-2 text-muted-foreground">
            Describe your idea and let AI help you plan it out
          </p>
        </div>

        {!breakdown && !isAnalyzing && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What do you want to build?</CardTitle>
                <CardDescription>
                  Describe your project idea in a sentence or two. Be as specific as possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IdeaInput 
                  showExamples={false} 
                  placeholder="e.g., A mobile app that helps people track their daily water intake and sends reminders..."
                />
              </CardContent>
            </Card>
          </div>
        )}

        {isAnalyzing && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-8 w-8 animate-pulse text-primary" />
                  </div>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-foreground">Analyzing your idea...</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  AI is breaking down your project into actionable components
                </p>
                {streamingText && (
                  <div className="mt-6 max-h-40 w-full overflow-y-auto rounded-lg bg-secondary/50 p-4 text-left">
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {streamingText}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => analyzeIdea(idea)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {breakdown && (
          <div className="space-y-6">
            {/* Project Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{breakdown.title}</CardTitle>
                    <CardDescription className="mt-2">{breakdown.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Milestones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Project Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {breakdown.milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 rounded-lg border border-border p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-foreground">{milestone.name}</h4>
                          <Badge variant="outline">{milestone.timeframe}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Required Roles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Required Team Roles
                </CardTitle>
                <CardDescription>
                  These are the skills and roles needed to bring this project to life
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {breakdown.roles.map((role, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border p-4"
                    >
                      <h4 className="font-medium text-foreground">{role.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {role.skills.map((skill, skillIndex) => (
                          <Badge key={skillIndex} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Challenges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Potential Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {breakdown.challenges.map((item, index) => (
                    <div key={index} className="rounded-lg bg-secondary/50 p-4">
                      <h4 className="font-medium text-foreground">{item.challenge}</h4>
                      <div className="mt-2 flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <p className="text-sm text-muted-foreground">{item.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
              <div>
                <h3 className="font-semibold text-foreground">Ready to start?</h3>
                <p className="text-sm text-muted-foreground">
                  Create this project and start recruiting team members
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBreakdown(null)
                    setIdea("")
                  }}
                >
                  Start Over
                </Button>
                <Button onClick={handleCreateProject} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Project
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CreateProjectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CreateProjectContent />
    </Suspense>
  )
}
