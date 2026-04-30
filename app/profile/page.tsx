"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR, { mutate } from "swr"
import {
  Compass,
  Gamepad2,
  Loader2,
  Music,
  Pencil,
  Rocket,
  Save,
  Sparkles,
  X,
  Zap,
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
  skills: string[]
  interests: string[]
  current_goals: string
  availability: string
  companion_name: string
  companion_mood: string
  companion_color: string
  companion_traits: string[]
}

const blankProfile: ProfileDraft = {
  full_name: "",
  bio: "",
  location: "",
  website: "",
  skills: [],
  interests: [],
  current_goals: "",
  availability: "",
  companion_name: "",
  companion_mood: "curious",
  companion_color: "indigo",
  companion_traits: [],
}

const skillOptions = [
  "Product ideas",
  "Design",
  "Engineering",
  "Writing",
  "Research",
  "Marketing",
  "Video",
  "Community",
  "Music",
  "Gaming",
  "No-code",
  "Planning",
]

const interestOptions = [
  "Live music",
  "Gaming",
  "Design",
  "Fitness",
  "Startups",
  "Studying",
  "NYC",
  "Photography",
  "AI tools",
  "Campus events",
  "Side projects",
  "Creative work",
]

const moodOptions = ["curious", "focused", "fast-moving", "creative", "low-pressure", "social"]

const companionColors = [
  { value: "indigo", label: "Indigo", className: "bg-indigo-500" },
  { value: "sky", label: "Sky", className: "bg-sky-500" },
  { value: "mint", label: "Mint", className: "bg-emerald-500" },
  { value: "rose", label: "Rose", className: "bg-rose-500" },
]

const sparkCategories = [
  { name: "Build", description: "Products, tools, clubs, or small ventures.", icon: Rocket },
  { name: "Learn", description: "Study, practice, or figure something out together.", icon: Sparkles },
  { name: "Move", description: "Gym, sports, walks, runs, and active routines.", icon: Zap },
  { name: "Go", description: "Concerts, city plans, campus events, short trips.", icon: Compass },
  { name: "Create", description: "Music, video, design, writing, games, and art.", icon: Music },
]

const fallbackTraits = [
  "good at product ideas",
  "likes live music",
  "moves fast",
  "looking for collaborators",
  "into gaming and design",
  "free on weekends",
]

const floatingPositions = [
  "left-3 top-4 md:left-4 md:top-8",
  "right-3 top-20 md:right-2 md:top-10",
  "left-3 top-36 md:left-0 md:top-36",
  "right-3 bottom-28 md:right-0 md:top-36",
  "left-3 bottom-14 md:left-16 md:bottom-6",
  "right-3 bottom-4 md:right-12 md:bottom-8",
]

function normalizeProfile(profile: any): ProfileDraft {
  return {
    full_name: profile?.full_name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    website: profile?.website || "",
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    interests: Array.isArray(profile?.interests) ? profile.interests : [],
    current_goals: profile?.current_goals || "",
    availability: profile?.availability || "",
    companion_name: profile?.companion_name || "",
    companion_mood: profile?.companion_mood || "curious",
    companion_color: profile?.companion_color || "indigo",
    companion_traits: Array.isArray(profile?.companion_traits) ? profile.companion_traits : [],
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
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
        .order("created_at", { ascending: false })
        .limit(3)
      return data || []
    }
  )

  const displayProfile = isEditing ? editForm : normalizeProfile(profile)

  const traitLines = useMemo(() => {
    const savedTraits = displayProfile.companion_traits
      .map((trait) => trait.trim())
      .filter(Boolean)

    const derivedTraits = [
      ...displayProfile.skills.slice(0, 2).map((skill) => `good at ${skill.toLowerCase()}`),
      ...displayProfile.interests.slice(0, 2).map((interest) => `into ${interest.toLowerCase()}`),
      displayProfile.current_goals || "looking for collaborators",
      displayProfile.availability ? `free ${displayProfile.availability.replace(/-/g, " ")}` : "free on weekends",
    ].filter(Boolean)

    return [...savedTraits, ...derivedTraits, ...fallbackTraits].slice(0, 6)
  }, [displayProfile])

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

  const toggleListValue = (field: "skills" | "interests", value: string) => {
    setEditForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }))
  }

  const updateCompanionTrait = (index: number, value: string) => {
    setEditForm((current) => ({
      ...current,
      companion_traits: (current.companion_traits.length > index
        ? current.companion_traits
        : [...current.companion_traits, ""]
      ).map((trait, traitIndex) => (traitIndex === index ? value : trait)),
    }))
  }

  const addCompanionTrait = () => {
    setEditForm((current) => ({
      ...current,
      companion_traits: [...current.companion_traits, ""].slice(0, 6),
    }))
  }

  const removeCompanionTrait = (index: number) => {
    setEditForm((current) => ({
      ...current,
      companion_traits: current.companion_traits.filter((_, traitIndex) => traitIndex !== index),
    }))
  }

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    setSaveError("")

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name,
          bio: editForm.bio,
          location: editForm.location,
          website: editForm.website,
          skills: editForm.skills,
          interests: editForm.interests,
          current_goals: editForm.current_goals,
          availability: editForm.availability,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      const { error: companionError } = await supabase
        .from("profiles")
        .update({
          companion_name: editForm.companion_name,
          companion_mood: editForm.companion_mood,
          companion_color: editForm.companion_color,
          companion_traits: editForm.companion_traits.map((trait) => trait.trim()).filter(Boolean),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (companionError) {
        setSaveError(
          companionError.message.includes("companion")
            ? "Basic profile saved. Companion fields are missing in Supabase. Run scripts/005_add_profile_companion_fields.sql, then save again."
            : "Basic profile saved, but Companion fields could not be saved."
        )
        return
      }

      mutate(`profile-${user.id}`)
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving profile:", error)
      setSaveError(
        error instanceof Error && error.message.includes("companion")
          ? "Companion fields are missing in Supabase. Run scripts/005_add_profile_companion_fields.sql, then save again."
          : "Could not save profile. Please try again."
      )
    } finally {
      setIsSaving(false)
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
              Your basic profile plus a pixel Companion that shows what you can start with others.
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

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
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
                    <div className="grid gap-3">
                      <Input
                        value={editForm.full_name}
                        onChange={(event) => setEditForm({ ...editForm, full_name: event.target.value })}
                        placeholder="Name"
                      />
                      <Textarea
                        value={editForm.bio}
                        onChange={(event) => setEditForm({ ...editForm, bio: event.target.value })}
                        placeholder="Short bio"
                        className="min-h-[90px]"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="truncate text-xl font-semibold text-foreground">
                        {displayProfile.full_name || "Unnamed starter"}
                      </h2>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                      <p className="mt-4 text-sm text-foreground">
                        {displayProfile.bio || "Add a short bio so people know what you are about."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <EditableField
                  label="Location"
                  value={editForm.location}
                  displayValue={displayProfile.location || "Flexible"}
                  editing={isEditing}
                  onChange={(value) => setEditForm({ ...editForm, location: value })}
                />
                <EditableField
                  label="Website"
                  value={editForm.website}
                  displayValue={displayProfile.website || "Not added"}
                  editing={isEditing}
                  onChange={(value) => setEditForm({ ...editForm, website: value })}
                />
                <EditableField
                  label="Wants to start"
                  value={editForm.current_goals}
                  displayValue={displayProfile.current_goals || "Looking for collaborators"}
                  editing={isEditing}
                  onChange={(value) => setEditForm({ ...editForm, current_goals: value })}
                  className="sm:col-span-2"
                />
                <div className="rounded-lg border border-border bg-secondary/35 p-3 sm:col-span-2">
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
                    <p className="mt-1 text-sm font-medium capitalize text-foreground">
                      {displayProfile.availability ? displayProfile.availability.replace(/-/g, " ") : "Flexible"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-border p-5">
                <Badge variant="secondary" className="gap-2">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  Companion
                </Badge>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">Pixel identity layer</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Companion has its own editable traits, backed by your Profile data in Supabase.
                </p>
              </div>

              <div className="relative min-h-[430px] overflow-hidden bg-card">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <PixelCompanion color={displayProfile.companion_color} />
                  <div className="mt-2 text-center">
                    <p className="font-semibold text-foreground">
                      {displayProfile.companion_name || `${displayProfile.full_name || "Your"} Companion`}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {displayProfile.companion_mood.replace(/-/g, " ")}
                    </p>
                  </div>
                </div>
                {traitLines.map((trait, index) => (
                  <div
                    key={`${trait}-${index}`}
                    className={`absolute z-20 max-w-[150px] border-2 border-foreground bg-background px-3 py-2 text-xs font-medium shadow-[4px_4px_0_var(--foreground)] sm:max-w-[190px] ${floatingPositions[index]}`}
                  >
                    {trait}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Editable Companion Traits</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                These are normal profile attributes. The Companion just makes them more memorable.
              </p>

              <div className="mt-5 grid gap-3 rounded-lg border border-border bg-secondary/25 p-4">
                <EditableField
                  label="Companion Name"
                  value={editForm.companion_name}
                  displayValue={displayProfile.companion_name || "Not named yet"}
                  editing={isEditing}
                  onChange={(value) => setEditForm({ ...editForm, companion_name: value })}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Mood</p>
                    {isEditing ? (
                      <select
                        value={editForm.companion_mood}
                        onChange={(event) => setEditForm({ ...editForm, companion_mood: event.target.value })}
                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {moodOptions.map((mood) => (
                          <option key={mood} value={mood}>
                            {mood.replace(/-/g, " ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1 text-sm font-medium capitalize text-foreground">
                        {displayProfile.companion_mood.replace(/-/g, " ")}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Color</p>
                    {isEditing ? (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {companionColors.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, companion_color: color.value })}
                            className={`flex h-10 items-center justify-center rounded-md border text-xs ${
                              editForm.companion_color === color.value
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-border"
                            }`}
                            aria-label={color.label}
                          >
                            <span className={`h-4 w-4 rounded-sm ${color.className}`} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-medium capitalize text-foreground">
                        {displayProfile.companion_color}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Speech Lines</p>
                    {isEditing && editForm.companion_traits.length < 6 && (
                      <Button type="button" variant="outline" size="sm" onClick={addCompanionTrait}>
                        Add line
                      </Button>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-3 grid gap-2">
                      {(editForm.companion_traits.length > 0 ? editForm.companion_traits : [""]).map((trait, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={trait}
                            onChange={(event) => updateCompanionTrait(index, event.target.value)}
                            placeholder="good at product ideas"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeCompanionTrait(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : displayProfile.companion_traits.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {displayProfile.companion_traits.map((trait) => (
                        <Badge key={trait} variant="secondary">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No custom lines yet</p>
                  )}
                </div>
              </div>

              <TraitEditor
                title="Good at"
                options={skillOptions}
                selected={displayProfile.skills}
                editing={isEditing}
                onToggle={(value) => toggleListValue("skills", value)}
              />
              <TraitEditor
                title="Into"
                options={interestOptions}
                selected={displayProfile.interests}
                editing={isEditing}
                onToggle={(value) => toggleListValue("interests", value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Spark Categories</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sparks are things you want to start with others. Keep the system focused.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/create">Create Spark</Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {sparkCategories.map((category) => {
                  const Icon = category.icon
                  return (
                    <div key={category.name} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-foreground">{category.name}</h3>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recent Sparks</h2>
              <p className="mt-1 text-sm text-muted-foreground">Things this profile wants to start.</p>
            </div>
            <Badge variant="outline">{sparks?.length || 0} active</Badge>
          </div>

          {sparks && sparks.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {sparks.map((spark: any) => (
                <Card key={spark.id} className="border-border/80">
                  <CardContent className="p-4">
                    <Badge variant="secondary">{spark.ai_breakdown?.category || "Build"}</Badge>
                    <h3 className="mt-3 line-clamp-2 font-semibold text-foreground">{spark.title}</h3>
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
  editing,
  onChange,
  className,
}: {
  label: string
  value: string
  displayValue: string
  editing: boolean
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-border bg-secondary/35 p-3 ${className || ""}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      {editing ? (
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" />
      ) : (
        <p className="mt-1 text-sm font-medium text-foreground">{displayValue}</p>
      )}
    </div>
  )
}

function TraitEditor({
  title,
  options,
  selected,
  editing,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  editing: boolean
  onToggle: (value: string) => void
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {editing ? (
          options.map((option) => (
            <Badge
              key={option}
              variant={selected.includes(option) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onToggle(option)}
            >
              {option}
            </Badge>
          ))
        ) : selected.length > 0 ? (
          selected.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Not added yet</p>
        )}
      </div>
    </div>
  )
}
