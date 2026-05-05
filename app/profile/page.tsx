"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR, { mutate } from "swr"
import {
  Archive,
  Gamepad2,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  X,
} from "lucide-react"
import { Navigation } from "@/components/navigation"
import { PixelCompanion } from "@/components/pixel-companion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

type ProfileDraft = {
  full_name: string
  bio: string
  location: string
  website: string
  current_goals: string
  availability: string
}

const blankProfile: ProfileDraft = {
  full_name: "",
  bio: "",
  location: "",
  website: "",
  current_goals: "",
  availability: "",
}

const fallbackLines = [
  "wants to start something real",
  "open to building with others",
  "has a spark in progress",
  "looking for the right first step",
  "likes low-pressure starts",
  "ready to begin",
]

const floatingPositions = [
  "left-[4%] top-[6%] [--igni-travel:24px] [animation-delay:-0.5s]",
  "right-[4%] top-[10%] [--igni-travel:-22px] [animation-delay:-2.1s]",
  "left-[3%] top-[47%] [--igni-travel:26px] [animation-delay:-3.4s]",
  "right-[3%] top-[51%] [--igni-travel:-24px] [animation-delay:-1.3s]",
  "left-[7%] bottom-[6%] [--igni-travel:20px] [animation-delay:-4.5s]",
  "right-[7%] bottom-[6%] [--igni-travel:-26px] [animation-delay:-2.9s]",
]

const goalsPrefix = "profile:goals:"
const availabilityPrefix = "profile:availability:"

function readStoredValue(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return ""
  const item = value.find((entry) => typeof entry === "string" && entry.startsWith(prefix))
  return typeof item === "string" ? item.slice(prefix.length) : ""
}

function mergeStoredValue(value: unknown, prefix: string, nextValue: string) {
  const existing = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && !entry.startsWith(prefix))
    : []

  return nextValue.trim() ? [...existing, `${prefix}${nextValue.trim()}`] : existing
}

function normalizeProfile(profile: any): ProfileDraft {
  return {
    full_name: profile?.full_name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    website: profile?.website || "",
    current_goals: profile?.current_goals || readStoredValue(profile?.interests, goalsPrefix),
    availability: profile?.availability || readStoredValue(profile?.skills, availabilityPrefix),
  }
}

function getSparkSummary(sparks: any[] | undefined) {
  if (!sparks || sparks.length === 0) return ""
  return sparks
    .slice(0, 3)
    .map((spark) => {
      const category = spark.ai_breakdown?.category ? `[${spark.ai_breakdown.category}] ` : ""
      return `${category}${spark.title}: ${spark.description || spark.ai_breakdown?.description || ""}`
    })
    .join("\n")
}

function makeLocalLines(profile: ProfileDraft, sparks: any[] | undefined) {
  const lines = [
    profile.bio ? profile.bio.split(/[.!?。！？]/)[0] : "",
    profile.current_goals,
    profile.availability ? `usually free ${profile.availability.replace(/-/g, " ")}` : "",
    profile.location ? `based around ${profile.location}` : "",
    ...(sparks || []).slice(0, 2).map((spark) => `starting ${spark.title}`),
  ].filter(Boolean)

  return [...lines, ...fallbackLines].slice(0, 6)
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [deletingSparkId, setDeletingSparkId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState("")
  const [generatedLines, setGeneratedLines] = useState<string[]>([])
  const [editForm, setEditForm] = useState<ProfileDraft>(blankProfile)

  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  })

  const { data: profile, isLoading: profileLoading } = useSWR(
    user ? `profile-${user.id}` : null,
    async () => {
      if (!user) return null
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      return data
    }
  )

  const { data: sparks } = useSWR(
    user ? `profile-sparks-${user.id}` : null,
    async () => {
      if (!user) return []
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, ai_breakdown, status, created_at")
        .eq("owner_id", user.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(3)
      return data || []
    }
  )

  const displayProfile = isEditing ? editForm : normalizeProfile(profile)

  const companionLines = useMemo(() => {
    return generatedLines.length > 0 ? generatedLines.slice(0, 6) : makeLocalLines(displayProfile, sparks)
  }, [displayProfile, generatedLines, sparks])

  const hasCompanionContext = Boolean(
    generatedLines.length > 0 ||
    displayProfile.bio ||
    displayProfile.current_goals ||
    displayProfile.availability ||
    displayProfile.location ||
    (sparks && sparks.length > 0)
  )

  const startEditing = () => {
    setEditForm(normalizeProfile(profile))
    setSaveError("")
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setEditForm(blankProfile)
    setSaveError("")
    setIsEditing(false)
  }

  const handleArchiveSpark = async (spark: any) => {
    if (!user) return
    if (!window.confirm("Archive this Spark? It will leave Browse but stay saved.")) return

    setDeletingSparkId(spark.id)
    setSaveError("")

    try {
      const nextBreakdown = {
        ...(spark.ai_breakdown || {}),
        status: "archived",
      }

      const { error } = await supabase
        .from("projects")
        .update({
          status: "archived",
          ai_breakdown: nextBreakdown,
        })
        .eq("id", spark.id)
        .eq("owner_id", user.id)

      if (error) throw error

      mutate(
        `profile-sparks-${user.id}`,
        (current: any[] | undefined) => current?.filter((currentSpark) => currentSpark.id !== spark.id) || [],
        { revalidate: false }
      )
    } catch (error) {
      console.error("Error archiving Spark:", error)
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Unknown Supabase error"
      setSaveError(`Could not archive Spark: ${message}`)
    } finally {
      setDeletingSparkId(null)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    setSaveError("")

    try {
      const profilePayload = {
        full_name: editForm.full_name,
        bio: editForm.bio,
        location: editForm.location,
        website: editForm.website,
        interests: mergeStoredValue(profile?.interests, goalsPrefix, editForm.current_goals),
        skills: mergeStoredValue(profile?.skills, availabilityPrefix, editForm.availability),
        updated_at: new Date().toISOString(),
      }

      const { data: existingProfile, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      if (lookupError) throw lookupError

      const query = existingProfile
        ? supabase
            .from("profiles")
            .update(profilePayload)
            .eq("id", user.id)
        : supabase
            .from("profiles")
            .insert({ id: user.id, ...profilePayload })

      const { error } = await query

      if (error) throw error

      mutate(`profile-${user.id}`, { ...profile, id: user.id, ...profilePayload }, { revalidate: false })
      setIsEditing(false)
      setGeneratedLines([])
    } catch (error) {
      console.error("Error saving profile:", error)
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Unknown Supabase error"
      setSaveError(`Could not save profile: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const generateCompanionLines = async () => {
    setIsGenerating(true)
    setSaveError("")

    try {
      const response = await fetch("/api/ai/companion-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayProfile.full_name,
          bio: displayProfile.bio,
          current_goals: displayProfile.current_goals,
          availability: displayProfile.availability,
          location: displayProfile.location,
          sparks: getSparkSummary(sparks),
        }),
      })

      if (!response.ok) throw new Error(await response.text())

      const data = await response.json()
      setGeneratedLines(Array.isArray(data.lines) ? data.lines : [])
    } catch (error) {
      console.error("Error generating companion lines:", error)
      setSaveError("Could not generate Igni lines right now.")
    } finally {
      setIsGenerating(false)
    }
  }

  if (userLoading || profileLoading) {
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
    router.push("/auth/login?redirect=/profile")
    return null
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
            <p className="mt-1 text-muted-foreground">
              Describe yourself and what you want to start. Ignit turns that into Igni's voice.
            </p>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEditing}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {saveError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {saveError}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border-4 border-background shadow-sm">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                    {displayProfile.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      value={editForm.full_name}
                      onChange={(event) => setEditForm({ ...editForm, full_name: event.target.value })}
                      placeholder="Name"
                    />
                  ) : (
                    <>
                      <h2
                        className={`truncate text-xl font-semibold ${
                          displayProfile.full_name ? "text-foreground" : "text-muted-foreground/60"
                        }`}
                      >
                        {displayProfile.full_name || "Unnamed starter"}
                      </h2>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <EditableTextArea
                  label="About me"
                  value={editForm.bio}
                  displayValue={displayProfile.bio}
                  editing={isEditing}
                  placeholder="Example: I like starting small things with people. I care about music, design, and getting ideas out fast..."
                  emptyText="Example: I like starting small things with people. I care about music, design, and getting ideas out fast..."
                  onChange={(value) => setEditForm({ ...editForm, bio: value })}
                />
                <EditableTextArea
                  label="What I want to start"
                  value={editForm.current_goals}
                  displayValue={displayProfile.current_goals}
                  editing={isEditing}
                  placeholder="Example: I want to find people to build small tools, go to live shows, and start a campus creative group..."
                  emptyText="Example: I want to find people to build small tools, go to live shows, and start a campus creative group..."
                  onChange={(value) => setEditForm({ ...editForm, current_goals: value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableField
                    label="Location"
                    value={editForm.location}
                    displayValue={displayProfile.location}
                    emptyText="Example: NYC, campus, online"
                    editing={isEditing}
                    onChange={(value) => setEditForm({ ...editForm, location: value })}
                  />
                  <EditableField
                    label="Website"
                    value={editForm.website}
                    displayValue={displayProfile.website}
                    emptyText="Example: portfolio, project page, link"
                    editing={isEditing}
                    onChange={(value) => setEditForm({ ...editForm, website: value })}
                  />
                </div>
                <div className="rounded-lg border border-border bg-secondary/35 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Availability</p>
                  {isEditing ? (
                    <select
                      value={editForm.availability}
                      onChange={(event) => setEditForm({ ...editForm, availability: event.target.value })}
                      className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select availability</option>
                      <option value="weekends">Weekends</option>
                      <option value="evenings">Evenings</option>
                      <option value="few-hours">A few hours a week</option>
                      <option value="flexible">Flexible</option>
                      <option value="exploring">Just exploring</option>
                    </select>
                  ) : (
                    <p
                      className={`mt-1 text-sm font-medium capitalize ${
                        displayProfile.availability ? "text-foreground" : "italic text-muted-foreground/60"
                      }`}
                    >
                      {displayProfile.availability ? displayProfile.availability.replace(/-/g, " ") : "Example: weekends"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Badge variant="secondary" className="gap-2">
                      <Gamepad2 className="h-3.5 w-3.5" />
                      Igni
                    </Badge>
                    <h2 className="mt-3 font-serif text-4xl italic text-foreground">Igni</h2>
                  </div>
                  <Button onClick={generateCompanionLines} disabled={isGenerating} size="sm">
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate
                  </Button>
                </div>
              </div>

              <div className="relative min-h-[430px] overflow-hidden bg-card">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <PixelCompanion />
                </div>
                {companionLines.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className={`igni-pixel-cloud z-20 ${hasCompanionContext ? "" : "is-empty"} ${floatingPositions[index]}`}
                  >
                    <span className="relative z-10 whitespace-normal">{line}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">My Sparks</h2>
                <p className="mt-1 text-sm text-muted-foreground">These give Igni context.</p>
              </div>
              <Button asChild size="sm">
                <Link href="/create">Create Spark</Link>
              </Button>
            </div>

            {sparks && sparks.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {sparks.map((spark: any) => (
                  <Card key={spark.id} className="border-border/80">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Badge variant="secondary">{spark.ai_breakdown?.category || "Build"}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleArchiveSpark(spark)}
                          disabled={deletingSparkId === spark.id}
                          aria-label="Archive Spark"
                        >
                          {deletingSparkId === spark.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Link href={`/project/${spark.id}`} className="mt-3 block">
                        <h3 className="line-clamp-2 font-semibold text-foreground hover:text-primary">{spark.title}</h3>
                      </Link>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{spark.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
                <p className="font-medium text-foreground">No Sparks yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create one to show what you want to start.</p>
                <Button asChild className="mt-4">
                  <Link href="/create">Create Spark</Link>
                </Button>
              </div>
            )}
        </section>
      </main>
    </div>
  )
}

function EditableField({
  label,
  value,
  displayValue,
  emptyText,
  editing,
  onChange,
}: {
  label: string
  value: string
  displayValue: string
  emptyText: string
  editing: boolean
  onChange: (value: string) => void
}) {
  const hasValue = Boolean(displayValue)

  return (
    <div className="rounded-lg border border-border bg-secondary/35 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      {editing ? (
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" />
      ) : (
        <p className={`mt-1 text-sm font-medium ${hasValue ? "text-foreground" : "italic text-muted-foreground/60"}`}>
          {hasValue ? displayValue : emptyText}
        </p>
      )}
    </div>
  )
}

function EditableTextArea({
  label,
  value,
  displayValue,
  editing,
  placeholder,
  emptyText,
  onChange,
}: {
  label: string
  value: string
  displayValue: string
  editing: boolean
  placeholder: string
  emptyText: string
  onChange: (value: string) => void
}) {
  const hasValue = Boolean(displayValue)

  return (
    <div className="rounded-lg border border-border bg-secondary/35 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      {editing ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-2 min-h-[120px]"
        />
      ) : (
        <p
          className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${
            hasValue ? "text-foreground" : "italic text-muted-foreground/60"
          }`}
        >
          {hasValue ? displayValue : emptyText}
        </p>
      )}
    </div>
  )
}
