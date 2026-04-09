"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { IdeaInput } from "@/components/idea-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, CheckCircle, Users, Target, AlertTriangle, ArrowRight, RefreshCw, Calendar, Download, Edit3, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"

interface ProjectBreakdown {
  one_liner: string
  title: string
  description: string
  problem: string
  target_users: string
  mvp: string[]
  first_week: Array<{
    day: string
    goal: string
  }>
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
  const [editableIdea, setEditableIdea] = useState(initialIdea)
  const [isEditingIdea, setIsEditingIdea] = useState(false)
  const [breakdown, setBreakdown] = useState<ProjectBreakdown | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState(0)
  const loadingMessages = [
    "Analyzing your idea...",
    "Structuring the project...",
    "Identifying key features...",
    "Defining team roles...",
    "Planning the roadmap...",
    "Almost there...",
  ]
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  })

  useEffect(() => {
    if (initialIdea && user && !breakdown && !isAnalyzing) {
      analyzeIdea(initialIdea)
    }
  }, [initialIdea, user])

  // Sync editable idea when breakdown changes
  useEffect(() => {
    if (breakdown) {
      setEditableIdea(idea)
      setIsEditingIdea(false)
    }
  }, [breakdown])

  const handleRegenerate = () => {
    if (editableIdea.trim()) {
      setIdea(editableIdea)
      analyzeIdea(editableIdea)
    }
  }

  const downloadProjectPlan = () => {
    if (!breakdown) return
    const content = `# ${breakdown.title}\n\n${breakdown.description}\n\n---\n\n## One-Liner\n${breakdown.one_liner}\n\n## Problem This Solves\n${breakdown.problem}\n\n## Target Users\n${breakdown.target_users}\n\n## MVP (What's Included in v1)\n${breakdown.mvp.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n\n## First Week Plan\n${breakdown.first_week.map(day => `- **${day.day}**: ${day.goal}`).join("\n")}\n\n## Milestones\n${breakdown.milestones.map(m => `- **${m.name}** (${m.timeframe}): ${m.description}`).join("\n")}\n\n## Required Team Roles\n${breakdown.roles.map(r => `- **${r.title}**: ${r.description}\n  Skills needed: ${r.skills.join(", ")}`).join("\n")}\n\n## Potential Challenges\n${breakdown.challenges.map(c => `- **${c.challenge}**: ${c.solution}`).join("\n")}\n`

    // Open in new tab as HTML (renders markdown nicely)
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${breakdown.title} - Project Plan</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { margin-top: 30px; color: #333; }
    h3 { margin-top: 20px; color: #555; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${breakdown.title}</h1>
  <p><em>${breakdown.description}</em></p>
  <hr>
  <h2>One-Liner</h2>
  <p>${breakdown.one_liner}</p>
  <h2>Problem This Solves</h2>
  <p>${breakdown.problem}</p>
  <h2>Target Users</h2>
  <p>${breakdown.target_users}</p>
  <h2>MVP (What's Included in v1)</h2>
  <ol>${breakdown.mvp.map(item => `<li>${item}</li>`).join("")}</ol>
  <h2>First Week Plan</h2>
  <ul>${breakdown.first_week.map(day => `<li><strong>${day.day}:</strong> ${day.goal}</li>`).join("")}</ul>
  <h2>Milestones</h2>
  <ul>${breakdown.milestones.map(m => `<li><strong>${m.name}</strong> (${m.timeframe}): ${m.description}</li>`).join("")}</ul>
  <h2>Required Team Roles</h2>
  <ul>${breakdown.roles.map(r => `<li><strong>${r.title}</strong>: ${r.description}<br><em>Skills needed: ${r.skills.join(", ")}</em></li>`).join("")}</ul>
  <h2>Potential Challenges</h2>
  <ul>${breakdown.challenges.map(c => `<li><strong>${c.challenge}:</strong> ${c.solution}</li>`).join("")}</ul>
  <hr>
  <p style="color:#999;font-size:14px;">Generated by Ignit</p>
</body>
</html>`

    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
  }

  const analyzeIdea = async (ideaText: string) => {
    if (!user) {
      router.push("/auth/login?redirect=/create")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setBreakdown(null)
    setLoadingMessage(0)
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMessage(prev => (prev + 1) % loadingMessages.length)
    }, 2000)

    try {
      const response = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: ideaText }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || "Failed to analyze idea")
      }

      const data = await response.json()
      if (data.result) {
        setBreakdown(data.result)
      } else {
        throw new Error("Invalid response format")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsAnalyzing(false)
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
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

      console.log("Project created successfully:", data.id)

      // Create a team for this project (non-blocking)
      const { error: teamError } = await supabase.from("teams").insert({
        project_id: data.id,
        name: `${breakdown.title} Team`,
      })
      
      if (teamError) {
        console.error("Team creation error (non-blocking):", teamError)
      }

      // Ensure we have the project ID before navigating
      if (data?.id) {
        console.log("Navigating to project:", data.id)
        router.push(`/project/${data.id}`)
      } else {
        throw new Error("Project created but no ID returned")
      }
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
                <p className="mt-6 text-lg font-semibold text-foreground">
                  {loadingMessages[loadingMessage]}
                </p>
                <div className="mt-4 h-1 w-32 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/2 animate-[shimmer_1.5s_infinite] rounded-full bg-primary" />
                </div>
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
            {/* Editable Prompt + Download */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-muted-foreground" />
                    Your Project Idea
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadProjectPlan}
                      className="gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      Download Plan
                    </Button>
                    {!isEditingIdea ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingIdea(true)}
                        className="gap-1.5"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit & Regenerate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isAnalyzing}
                        className="gap-1.5"
                      >
                        <Sparkles className="h-4 w-4" />
                        Regenerate
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isEditingIdea ? (
                  <div className="space-y-3">
                    <textarea
                      value={editableIdea}
                      onChange={(e) => setEditableIdea(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-none"
                      placeholder="Describe your project idea..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isAnalyzing || !editableIdea.trim()}
                      >
                        {isAnalyzing ? "Generating..." : "Generate New Plan"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditableIdea(idea)
                          setIsEditingIdea(false)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{idea}</p>
                )}
              </CardContent>
            </Card>

            {/* Project Overview - One Liner */}
            {breakdown.one_liner && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-medium text-foreground">{breakdown.one_liner}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Problem & Target Users */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">What Problem Does This Solve</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{breakdown.problem || breakdown.description}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Who Is This For</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{breakdown.target_users || "待定"}</p>
                </CardContent>
              </Card>
            </div>

            {/* MVP */}
            {breakdown.mvp && breakdown.mvp.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    MVP (What's Included in v1)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {breakdown.mvp.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* First Week Plan */}
            {breakdown.first_week && breakdown.first_week.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    First Week Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-7">
                    {breakdown.first_week.map((day, index) => (
                      <div key={index} className="rounded-lg bg-secondary/50 p-3 text-center">
                        <div className="text-xs font-medium text-primary">{day.day}</div>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-3">{day.goal}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
