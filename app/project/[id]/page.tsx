"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import useSWR, { mutate } from "swr"
import { ArrowLeft, Calendar, CheckCircle2, Clock, Edit3, Loader2, MapPin, MessageCircle, MessageSquare, Send, Trash2, UserRound, XCircle } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

type IntentBreakdown = {
  title?: string
  category?: string
  description?: string
  location?: string
  time_availability?: string
  looking_for?: string
  vibe?: string
  commitment?: string
  status?: string
}

type SparkEditForm = {
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

const detailFields: Array<{ key: keyof IntentBreakdown; label: string; icon: typeof MapPin }> = [
  { key: "location", label: "Location", icon: MapPin },
  { key: "time_availability", label: "Time", icon: Calendar },
  { key: "looking_for", label: "Looking for", icon: UserRound },
  { key: "vibe", label: "Vibe", icon: MessageCircle },
]

const getStatusLabel = (status: string, intentStatus?: string) => {
  if (intentStatus) return intentStatus
  if (status === "recruiting") return "open"
  if (status === "in_progress") return "matched"
  return status
}

export default function SparkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string | null
  const supabase = createClient()
  const [message, setMessage] = useState("")
  const [isSendingInterest, setIsSendingInterest] = useState(false)
  const [isDeletingSpark, setIsDeletingSpark] = useState(false)
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false)
  const [isSavingSpark, setIsSavingSpark] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<SparkEditForm>({
    title: "",
    category: "",
    description: "",
    location: "",
    time_availability: "",
    looking_for: "",
    vibe: "",
    commitment: "",
    status: "",
  })

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  })

  const { data: intent, isLoading, error } = useSWR(
    id ? ["intent", id] : null,
    async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error
      return data
    }
  )

  const { data: owner } = useSWR(
    intent?.owner_id ? ["intent-owner", intent.owner_id] : null,
    async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, location")
        .eq("id", intent.owner_id)
        .single()
      return data
    }
  )

  const { data: existingInterest } = useSWR(
    user && id ? ["intent-interest", id, user.id] : null,
    async () => {
      if (!user || !id) return null
      const { data } = await supabase
        .from("project_applications")
        .select("*")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      return data
    }
  )

  const isOwner = user?.id === intent?.owner_id

  useEffect(() => {
    if (!intent) return

    const details = (intent.ai_breakdown || {}) as IntentBreakdown
    setEditForm({
      title: details.title || intent.title || "",
      category: details.category || "",
      description: details.description || intent.description || "",
      location: details.location || "",
      time_availability: details.time_availability || "",
      looking_for: details.looking_for || "",
      vibe: details.vibe || "",
      commitment: details.commitment || "",
      status: details.status || getStatusLabel(intent.status || "recruiting"),
    })
  }, [intent])

  const { data: matchedTeam } = useSWR(
    existingInterest?.status === "accepted" && id ? ["matched-team", id] : null,
    async () => {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("project_id", id)
        .maybeSingle()
      return data
    },
  )

  const { data: interestCount } = useSWR(
    isOwner && id ? ["intent-interest-count", id] : null,
    async () => {
      const { count } = await supabase
        .from("project_applications")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id)
      return count || 0
    }
  )

  const { data: projectTeam, mutate: mutateProjectTeam } = useSWR(
    isOwner && id ? ["project-team", id] : null,
    async () => {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("project_id", id)
        .maybeSingle()
      return data
    }
  )

  const handleInterest = async () => {
    if (!user || !id) {
      router.push(`/auth/login?redirect=/project/${id}`)
      return
    }

    setIsSendingInterest(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase
        .from("project_applications")
        .insert({
          project_id: id,
          user_id: user.id,
          role_applied: "Interested",
          message: message.trim() || null,
        })
        .select("*")
        .single()

      if (error) throw error
      mutate(["intent-interest", id, user.id], data, { revalidate: false })
      setMessage("")
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send interest")
    } finally {
      setIsSendingInterest(false)
    }
  }

  const handleDeleteSpark = async () => {
    if (!user || !id || !isOwner) return
    if (!window.confirm("Delete this Spark? This cannot be undone.")) return

    setIsDeletingSpark(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id)

      if (error) throw error

      router.push("/profile")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete Spark")
    } finally {
      setIsDeletingSpark(false)
    }
  }

  const handleEditField = (field: keyof SparkEditForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  const handleSaveSpark = async () => {
    if (!user || !id || !intent || !isOwner) return

    const nextTitle = editForm.title.trim()
    const nextDescription = editForm.description.trim()

    if (!nextTitle || !nextDescription) {
      setErrorMessage("Title and description are required.")
      return
    }

    setIsSavingSpark(true)
    setErrorMessage(null)

    const currentBreakdown = (intent.ai_breakdown || {}) as IntentBreakdown
    const nextBreakdown: IntentBreakdown = {
      ...currentBreakdown,
      title: nextTitle,
      category: editForm.category.trim() || "Other",
      description: nextDescription,
      location: editForm.location.trim() || "Flexible",
      time_availability: editForm.time_availability.trim() || "Flexible",
      looking_for: editForm.looking_for.trim() || "Someone interested",
      vibe: editForm.vibe.trim() || "Low-pressure",
      commitment: editForm.commitment.trim() || "Flexible",
      status: editForm.status.trim() || getStatusLabel(intent.status || "recruiting"),
    }

    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          title: nextTitle,
          description: nextDescription,
          ai_breakdown: nextBreakdown,
          required_roles: nextBreakdown.looking_for ? [nextBreakdown.looking_for] : [],
        })
        .eq("id", id)
        .eq("owner_id", user.id)
        .select("*")
        .single()

      if (error) throw error

      mutate(["intent", id], data, { revalidate: false })
      setIsEditDialogOpen(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save Spark")
    } finally {
      setIsSavingSpark(false)
    }
  }

  const handleOpenWorkspace = async () => {
    if (!user || !id || !intent || !isOwner) return

    setIsOpeningWorkspace(true)
    setErrorMessage(null)

    try {
      let team = projectTeam

      if (!team) {
        const { data: newTeam, error: teamError } = await supabase
          .from("teams")
          .insert({
            project_id: id,
            name: `${title} Workspace`,
            created_by: user.id,
          })
          .select("id")
          .single()

        if (teamError) throw teamError
        team = newTeam
      }

      if (!team?.id) throw new Error("Could not open workspace")

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

      mutateProjectTeam()
      router.push(`/team/${team.id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not open workspace")
    } finally {
      setIsOpeningWorkspace(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!id || !intent) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Spark not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ? error.message : "This Spark may have been removed."}
          </p>
          <Button asChild className="mt-5">
            <Link href="/explore">Back to Browse</Link>
          </Button>
        </main>
      </div>
    )
  }

  const details = (intent.ai_breakdown || {}) as IntentBreakdown
  const title = details.title || intent.title
  const description = details.description || intent.description
  const status = getStatusLabel(intent.status, details.status)

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="space-y-5">
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{details.category || "Other"}</Badge>
                  <Badge variant="outline" className="capitalize">{status}</Badge>
                  {details.commitment && <Badge variant="secondary">{details.commitment}</Badge>}
                </div>
                <CardTitle className="pt-2 text-3xl font-semibold tracking-tight">{title}</CardTitle>
                <CardDescription className="text-base">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={owner?.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {owner?.full_name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{owner?.full_name || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground">Posted this Spark</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(intent.created_at), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              {detailFields.map((field) => {
                const Icon = field.icon
                return (
                  <Card key={field.key}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Icon className="h-4 w-4 text-primary" />
                        {field.label}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {details[field.key] || "Flexible"}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Want to join?</CardTitle>
                <CardDescription>
                  Send a short note so the other person knows why you are interested.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isOwner ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-secondary p-3 text-sm">
                      <span className="font-medium">{interestCount || 0}</span> interested
                    </div>
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" variant="outline">
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit Spark
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Spark Card</DialogTitle>
                          <DialogDescription>
                            Update the public card people see before they respond.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Title</p>
                            <Input
                              value={editForm.title}
                              onChange={(event) => handleEditField("title", event.target.value)}
                              placeholder="What do you want to do?"
                            />
                          </div>

                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Description</p>
                            <Textarea
                              value={editForm.description}
                              onChange={(event) => handleEditField("description", event.target.value)}
                              placeholder="Describe what this Spark is about."
                              className="min-h-24"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">Category</p>
                              <select
                                value={editForm.category}
                                onChange={(event) => handleEditField("category", event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="">Other</option>
                                <option value="Build">Build</option>
                                <option value="Learn">Learn</option>
                                <option value="Move">Move</option>
                                <option value="Go">Go</option>
                                <option value="Create">Create</option>
                              </select>
                            </div>

                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">Status</p>
                              <select
                                value={editForm.status}
                                onChange={(event) => handleEditField("status", event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="open">open</option>
                                <option value="matched">matched</option>
                                <option value="paused">paused</option>
                                <option value="done">done</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">Location</p>
                              <Input
                                value={editForm.location}
                                onChange={(event) => handleEditField("location", event.target.value)}
                                placeholder="NYC, campus, online..."
                              />
                            </div>

                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">Time</p>
                              <Input
                                value={editForm.time_availability}
                                onChange={(event) => handleEditField("time_availability", event.target.value)}
                                placeholder="Weekends, evenings, this Friday..."
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">Looking for</p>
                              <Input
                                value={editForm.looking_for}
                                onChange={(event) => handleEditField("looking_for", event.target.value)}
                                placeholder="Gym partner, designer, study buddy..."
                              />
                            </div>

                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">Commitment</p>
                              <Input
                                value={editForm.commitment}
                                onChange={(event) => handleEditField("commitment", event.target.value)}
                                placeholder="One-time, weekly, flexible..."
                              />
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Vibe</p>
                            <Input
                              value={editForm.vibe}
                              onChange={(event) => handleEditField("vibe", event.target.value)}
                              placeholder="Chill, focused, experimental..."
                            />
                          </div>
                        </div>

                        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                          <Button onClick={handleSaveSpark} disabled={isSavingSpark}>
                            {isSavingSpark ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Spark
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button asChild className="w-full" variant="outline">
                      <Link href="/teams?view=applications">Review interests</Link>
                    </Button>
                    <Button
                      className="w-full"
                      onClick={handleOpenWorkspace}
                      disabled={isOpeningWorkspace}
                    >
                      {isOpeningWorkspace ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="mr-2 h-4 w-4" />
                      )}
                      Open Workspace
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleDeleteSpark}
                      disabled={isDeletingSpark}
                    >
                      {isDeletingSpark ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete Spark
                    </Button>
                    {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                  </div>
                ) : existingInterest ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-secondary/60 p-3">
                      <div className="flex items-center gap-2">
                        {existingInterest.status === "accepted" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : existingInterest.status === "declined" ? (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Clock className="h-4 w-4 text-primary" />
                        )}
                        <p className="text-sm font-medium">
                          {existingInterest.status === "accepted"
                            ? "Matched"
                            : existingInterest.status === "declined"
                              ? "Interest closed"
                              : "Interest sent"}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {existingInterest.status === "accepted"
                          ? "You were accepted. Continue this Spark in the workspace."
                          : existingInterest.status === "declined"
                            ? "This response was declined."
                            : "The owner can review your note and accept you into the workspace."}
                      </p>
                    </div>
                    {existingInterest.status === "accepted" && matchedTeam?.id && (
                      <Button asChild className="w-full">
                        <Link href={`/team/${matchedTeam.id}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Open Workspace
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : user ? (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <Send className="mr-2 h-4 w-4" />
                        I'm interested
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send interest</DialogTitle>
                        <DialogDescription>
                          Keep it short. Say why this sounds fun or useful to you.
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="I’d be down for this because..."
                      />
                      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleInterest} disabled={isSendingInterest}>
                          {isSendingInterest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Send
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button asChild className="w-full">
                    <Link href={`/auth/login?redirect=/project/${id}`}>Sign in to respond</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
