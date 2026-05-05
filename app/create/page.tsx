"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { IdeaInput } from "@/components/idea-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"
import { useLanguage } from "@/lib/i18n/context"

interface IntentBreakdown {
  title: string
  category: string
  description: string
  location: string
  time_availability: string
  looking_for: string
  vibe: string
  commitment: string
  status: string
}

const intentFields: Array<{ key: keyof IntentBreakdown; label: string }> = [
  { key: "category", label: "Category" },
  { key: "location", label: "Location" },
  { key: "time_availability", label: "Time" },
  { key: "looking_for", label: "Looking for" },
  { key: "vibe", label: "Vibe" },
  { key: "commitment", label: "Commitment" },
]

const getPublishErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === "object") {
    const errorObject = error as Record<string, unknown>
    return [
      typeof errorObject.message === "string" ? errorObject.message : null,
      typeof errorObject.details === "string" ? errorObject.details : null,
      typeof errorObject.hint === "string" ? errorObject.hint : null,
      typeof errorObject.code === "string" ? errorObject.code : null,
    ].filter(Boolean).join(" ")
  }
  return "Failed to publish Spark"
}

const shouldRetryTeamWithoutCreatedBy = (error: unknown) => {
  const message = getPublishErrorMessage(error).toLowerCase()
  return message.includes("created_by") || message.includes("schema cache") || message.includes("pgrst204")
}

function CreateIntentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()

  const initialIdea = searchParams.get("idea") || ""
  const [idea, setIdea] = useState(initialIdea)
  const [editableIdea, setEditableIdea] = useState(initialIdea)
  const [structuredIdea, setStructuredIdea] = useState("")
  const [intent, setIntent] = useState<IntentBreakdown | null>(null)
  const [isStructuring, setIsStructuring] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState(0)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const structureRequestRef = useRef(0)
  const loadingMessages = t.create.loadingMessages
  const currentDraft = editableIdea.trim()
  const hasUnstructuredChanges = Boolean(intent && currentDraft && currentDraft !== structuredIdea)

  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  })

  useEffect(() => {
    if (initialIdea) {
      setIdea(initialIdea)
      setEditableIdea(initialIdea)
    }
  }, [initialIdea])

  useEffect(() => {
    if (initialIdea && user && !intent && !isStructuring) {
      structureIntent(initialIdea)
    }
  }, [initialIdea, user])

  const structureIntent = async (intentText: string) => {
    const promptText = intentText.trim()
    if (!promptText) return

    if (!user) {
      const redirect = `/create?idea=${encodeURIComponent(promptText)}`
      router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`)
      return
    }

    const requestId = structureRequestRef.current + 1
    structureRequestRef.current = requestId
    setIsStructuring(true)
    setError(null)
    setIntent(null)
    setStructuredIdea("")
    setLoadingMessage(0)
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current)
      loadingIntervalRef.current = null
    }
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMessage((prev) => (prev + 1) % loadingMessages.length)
    }, 1800)

    try {
      const response = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: promptText }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || "Failed to structure Spark")
      }

      const data = await response.json()
      if (!data.result) throw new Error("Invalid response format")
      if (structureRequestRef.current !== requestId) return
      setIdea(promptText)
      setEditableIdea(promptText)
      setStructuredIdea(promptText)
      setIntent(data.result)
    } catch (err) {
      if (structureRequestRef.current !== requestId) return
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      if (structureRequestRef.current === requestId) setIsStructuring(false)
      if (structureRequestRef.current === requestId && loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }
  }

  const handleRegenerate = () => {
    const nextIdea = editableIdea.trim()
    if (!nextIdea) return
    setIdea(nextIdea)
    structureIntent(nextIdea)
  }

  const handlePublish = async () => {
    if (!user || !intent) return
    if (hasUnstructuredChanges) {
      setError("Regenerate the Spark after editing the idea, then publish.")
      return
    }

    setIsPublishing(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: intent.title,
          description: intent.description,
          original_idea: idea,
          ai_breakdown: intent,
          required_roles: intent.looking_for ? [intent.looking_for] : [],
          tags: intent.category ? [intent.category] : [],
          status: "recruiting",
          owner_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      let { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          project_id: data.id,
          name: `${intent.title} Workspace`,
          created_by: user.id,
        })
        .select("id")
        .single()

      if (teamError && shouldRetryTeamWithoutCreatedBy(teamError)) {
        const fallback = await supabase
          .from("teams")
          .insert({
            project_id: data.id,
            name: `${intent.title} Workspace`,
          })
          .select("id")
          .single()

        team = fallback.data
        teamError = fallback.error
      }

      if (teamError) throw teamError
      if (!team?.id) throw new Error("Spark was created, but workspace could not be opened.")

      await supabase
        .from("team_members")
        .upsert(
          {
            team_id: team.id,
            user_id: user.id,
            role: "owner",
            status: "accepted",
          },
          { onConflict: "team_id,user_id" },
        )

      router.push(`/team/${team.id}`)
    } catch (err) {
      console.error("Failed to publish Spark:", err)
      setError(getPublishErrorMessage(err))
    } finally {
      setIsPublishing(false)
    }
  }

  if (userLoading || user === undefined) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!user) {
    const redirect = initialIdea ? `/create?idea=${encodeURIComponent(initialIdea)}` : "/create"
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <Card className="text-center">
            <CardContent className="py-12">
              <h2 className="text-2xl font-semibold text-foreground">{t.create.signInTitle}</h2>
              <p className="mt-2 text-muted-foreground">{t.create.signInDescription}</p>
              <Button asChild className="mt-6">
                <a href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}>{t.create.signInButton}</a>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t.create.title}</h1>
          <p className="mt-2 text-muted-foreground">{t.create.subtitle}</p>
        </div>

        {!intent && !isStructuring && (
          <Card>
            <CardHeader>
              <CardTitle>{t.create.promptTitle}</CardTitle>
              <CardDescription>{t.create.promptDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <IdeaInput showExamples={false} placeholder={t.create.promptPlaceholder} />
            </CardContent>
          </Card>
        )}

        {isStructuring && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-7 w-7 animate-pulse text-primary" />
                </div>
                <p className="mt-5 text-base font-medium text-foreground">
                  {loadingMessages[loadingMessage]}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-5">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">{error}</span>
              </div>
              <Button variant="outline" className="mt-4" onClick={() => structureIntent(idea)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t.create.retry}
              </Button>
            </CardContent>
          </Card>
        )}

        {intent && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {t.create.aiGenerated}
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">{t.create.reviewTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.create.reviewSubtitle}</p>
            </div>

            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{intent.category || "Other"}</Badge>
                  <Badge variant="outline">{intent.status || "open"}</Badge>
                </div>
                <CardTitle className="pt-2 text-2xl">{intent.title}</CardTitle>
                <CardDescription className="text-base">{intent.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {intentFields.map((field) => (
                  <div key={field.key} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">{field.label}</p>
                    <p className="mt-1 text-sm text-foreground">{intent[field.key] || "Flexible"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.create.ideaTitle}</CardTitle>
                <CardDescription>{t.create.reviewSubtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={editableIdea}
                  onChange={(event) => setEditableIdea(event.target.value)}
                  className="min-h-[96px]"
                  placeholder={t.create.editPlaceholder}
                />
                {hasUnstructuredChanges && (
                  <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                    You changed the idea. Regenerate the Spark before publishing so the card matches this draft.
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={handleRegenerate} disabled={!editableIdea.trim() || isStructuring || isPublishing}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t.create.regenerate}
                  </Button>
                  <Button onClick={handlePublish} disabled={isPublishing || isStructuring || hasUnstructuredChanges}>
                    {isPublishing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.create.creating}
                      </>
                    ) : (
                      <>
                        {t.create.createProject}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CreateIntentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background lg:pl-64" />}>
      <CreateIntentContent />
    </Suspense>
  )
}
