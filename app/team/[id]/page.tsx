"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import useSWR, { mutate } from "swr"
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ClipboardList,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"

type SparkBreakdown = {
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

type WorkspaceProject = {
  id: string
  title: string | null
  description: string | null
  status: string
  owner_id: string
  ai_breakdown: SparkBreakdown | null
  created_at: string
}

type WorkspaceTeam = {
  id: string
  name: string | null
  project_id: string
  project: WorkspaceProject | null
}

type Message = {
  id: string
  content: string
  created_at: string
  user_id: string
  user?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

type TeamMember = {
  id: string
  user_id: string
  role: string | null
  status: string
  user?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

type ProfileRelation = Profile | Profile[] | null

type WorkspaceTeamRow = Omit<WorkspaceTeam, "project"> & {
  project: WorkspaceProject | WorkspaceProject[] | null
}

type TeamMemberRow = Omit<TeamMember, "user"> & {
  user?: ProfileRelation
}

type MessageRow = Omit<Message, "user"> & {
  user?: ProfileRelation
}

type IgniMode = "plan" | "brainstorm" | "research" | "recap"

const igniModes: Array<{ id: IgniMode; label: string; icon: typeof Wand2 }> = [
  { id: "plan", label: "Plan", icon: Wand2 },
  { id: "brainstorm", label: "Ideas", icon: Lightbulb },
  { id: "research", label: "Research", icon: Search },
  { id: "recap", label: "Recap", icon: MessageSquare },
]

const igniPrompts: Array<{ mode: IgniMode; label: string; prompt: string }> = [
  { mode: "plan", label: "Plan this week", prompt: "@igni Help us decide the first concrete thing to do this week." },
  { mode: "brainstorm", label: "Give options", prompt: "@igni Give us a few good ways to start this Spark and the tradeoffs." },
  { mode: "research", label: "What to check", prompt: "@igni What should we look up or verify before we start?" },
  { mode: "recap", label: "Recap chat", prompt: "@igni Summarize the recent chat and list decisions, open questions, and next actions." },
]

const igniReplyPrefix = "__igni_reply__\n"

const getInitial = (name?: string | null) => name?.trim()?.[0]?.toUpperCase() || "I"

const getStatusLabel = (status?: string, sparkStatus?: string) => {
  if (sparkStatus) return sparkStatus
  if (status === "recruiting") return "open"
  if (status === "in_progress") return "matched"
  return status || "open"
}

const firstRelation = <T,>(relation: T | T[] | null | undefined) =>
  Array.isArray(relation) ? relation[0] || null : relation || null

const isIgniPrompt = (content: string) => /(^|\s)@igni\b/i.test(content)

const stripIgniMention = (content: string) =>
  content.replace(/(^|\s)@igni\b[:,]?\s*/i, " ").trim()

const isIgniReply = (content: string) => content.startsWith(igniReplyPrefix)

const getMessageContent = (content: string) =>
  isIgniReply(content) ? content.slice(igniReplyPrefix.length).trim() : content

export default function TeamWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messageInput, setMessageInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isRepairingWorkspace, setIsRepairingWorkspace] = useState(false)
  const [igniMode, setIgniMode] = useState<IgniMode>("plan")
  const [isAskingIgni, setIsAskingIgni] = useState(false)
  const [igniError, setIgniError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  const { data: user, isLoading: userLoading } = useSWR(
    "user",
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user ?? null
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  )

  const { data: team, isLoading: teamLoading } = useSWR(
    teamId ? `team-${teamId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          project_id,
          project:projects(id, title, description, status, owner_id, ai_breakdown, created_at)
        `)
        .eq("id", teamId)
        .single()

      if (error) throw error

      const row = data as unknown as WorkspaceTeamRow
      return {
        ...row,
        project: firstRelation(row.project),
      } as WorkspaceTeam
    },
  )

  const ownerId = team?.project?.owner_id

  const { data: ownerProfile } = useSWR(
    ownerId ? `workspace-owner-${ownerId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", ownerId)
        .single()

      if (error) return null
      return data as Profile
    },
  )

  const { data: members, mutate: mutateMembers } = useSWR(
    teamId ? `team-members-${teamId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          id,
          user_id,
          role,
          status,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq("team_id", teamId)
        .eq("status", "accepted")

      if (error) throw error

      return (data as unknown as TeamMemberRow[]).map((member) => ({
        ...member,
        user: firstRelation(member.user),
      }))
    },
  )

  const projectId = team?.project_id

  const { data: messages, error: messagesError, mutate: mutateMessages } = useSWR(
    projectId ? `workspace-messages-${projectId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(100)

      if (error) throw error

      const rows = data as unknown as MessageRow[]
      const profileIds = Array.from(new Set(rows.map((message) => message.user_id).filter(Boolean)))

      const { data: profiles } = profileIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", profileIds)
        : { data: [] }

      const profilesById = new Map((profiles as Profile[]).map((profile) => [profile.id, profile]))

      return rows.map((message) => ({
        ...message,
        user: profilesById.get(message.user_id) || null,
      }))
    },
  )

  useEffect(() => {
    if (!projectId) return

    const subscription = supabase
      .channel(`workspace-project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          mutateMessages()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [mutateMessages, projectId, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (user === null) {
      router.push(`/auth/login?redirect=/team/${teamId}`)
    }
  }, [router, teamId, user])

  const isOwner = Boolean(user?.id && team?.project?.owner_id === user.id)
  const isWorkspaceMember = Boolean(
    user?.id && (isOwner || members?.some((member) => member.user_id === user.id)),
  )
  const details = (team?.project?.ai_breakdown || {}) as SparkBreakdown
  const sparkTitle = details.title || team?.project?.title || team?.name || "Spark"
  const sparkDescription = details.description || team?.project?.description || "No brief yet."
  const sparkStatus = getStatusLabel(team?.project?.status, details.status)
  const visibleMembers = members || []
  const visibleMemberIds = new Set(visibleMembers.map((member) => member.user_id))
  const memberCount = visibleMembers.length + (ownerProfile && !visibleMemberIds.has(ownerProfile.id) ? 1 : 0)
  const firstMove = details.time_availability
    ? `Find a time: ${details.time_availability}`
    : details.looking_for
      ? `Start with the person you were looking for: ${details.looking_for}`
      : "Agree on the first small thing you can do together."
  const startSteps = [
    details.looking_for ? `Say what kind of ${details.looking_for} would help most.` : "Say what kind of person would help most.",
    details.time_availability ? `Pick a first time window: ${details.time_availability}.` : "Pick one time window for the first conversation.",
    "Decide one tiny action you can finish before the next check-in.",
  ]
  const currentMember = visibleMembers.find((member) => member.user_id === user?.id)
  const currentUserProfile: Profile | null = user
    ? {
        id: user.id,
        full_name:
          (isOwner ? ownerProfile?.full_name : currentMember?.user?.full_name) ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "You",
        avatar_url:
          (isOwner ? ownerProfile?.avatar_url : currentMember?.user?.avatar_url) ||
          user.user_metadata?.avatar_url ||
          null,
      }
    : null

  const appendLocalMessage = (message: Message) => {
    mutateMessages((currentMessages = []) => {
      if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) return currentMessages
      return [...currentMessages, message]
    }, false)
  }

  useEffect(() => {
    if (!user || !team || !isOwner || isRepairingWorkspace) return

    const repairWorkspace = async () => {
      setIsRepairingWorkspace(true)
      setSetupError(null)

      try {
        const { error: memberError } = await supabase
          .from("team_members")
          .upsert(
            {
              team_id: teamId,
              user_id: user.id,
              role: "owner",
              status: "accepted",
            },
            { onConflict: "team_id,user_id" },
          )

        if (memberError) throw memberError
        mutateMembers()
      } catch (error) {
        console.error("Failed to repair workspace membership:", error)
        setSetupError(error instanceof Error ? error.message : "Could not repair workspace access.")
      } finally {
        setIsRepairingWorkspace(false)
      }
    }

    repairWorkspace()
  }, [isOwner, isRepairingWorkspace, mutateMembers, supabase, team, teamId, user])

  const handleAskIgni = async (question: string, mode: IgniMode = igniMode) => {
    if (!question.trim() || !projectId || !user || !isWorkspaceMember) return

    setIsAskingIgni(true)
    setIgniError(null)

    try {
      const response = await fetch("/api/ai/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          question: question.trim(),
          mode,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      const answer = typeof data.answer === "string" ? data.answer.trim() : ""
      if (!answer) throw new Error("Igni returned an empty answer")

      const { data: insertedReply, error } = await supabase
        .from("messages")
        .insert({
          project_id: projectId,
          user_id: user.id,
          content: `${igniReplyPrefix}${answer}`,
        })
        .select("id, content, created_at, user_id")
        .single()

      if (error) throw error
      if (insertedReply && currentUserProfile) {
        appendLocalMessage({
          ...(insertedReply as MessageRow),
          user: currentUserProfile,
        })
      }
      mutateMessages()
    } catch (error) {
      setIgniError(error instanceof Error ? error.message : "Could not ask Igni")
    } finally {
      setIsAskingIgni(false)
    }
  }

  const handleSendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!messageInput.trim() || !projectId || !user || !isWorkspaceMember) return

    const content = messageInput.trim()
    const shouldAskIgni = isIgniPrompt(content)
    const igniQuestion = stripIgniMention(content) || content

    setIsSending(true)
    setMessageInput("")
    setIgniError(null)
    setSendError(null)

    try {
      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          project_id: projectId,
          user_id: user.id,
          content,
        })
        .select("id, content, created_at, user_id")
        .single()

      if (error) throw error
      if (insertedMessage && currentUserProfile) {
        appendLocalMessage({
          ...(insertedMessage as MessageRow),
          user: currentUserProfile,
        })
      }
      mutateMessages()

      if (shouldAskIgni) {
        setIsSending(false)
        await handleAskIgni(igniQuestion)
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      setSendError(error instanceof Error ? error.message : "Could not send message.")
      setMessageInput(content)
    } finally {
      setIsSending(false)
    }
  }

  if (userLoading || user === undefined || teamLoading) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (user === null) return null

  if (!team) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Workspace not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This workspace may have been removed or you may not have access.
          </p>
          <Button asChild className="mt-5">
            <Link href="/teams">Back to My Sparks</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-[1600px] flex-col px-3 py-3 sm:px-4 lg:px-5">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-3">
            <section className="rounded-lg border border-border bg-card p-4">
              <Link
                href="/teams"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                My Sparks
              </Link>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Workspace
                </Badge>
                <Badge variant="outline" className="capitalize">{sparkStatus}</Badge>
                {details.category && <Badge>{details.category}</Badge>}
              </div>

              <h1 className="mt-3 line-clamp-2 text-lg font-semibold text-foreground">{sparkTitle}</h1>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{sparkDescription}</p>

              <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                <div className="rounded-md bg-secondary/60 p-2">
                  <span className="font-medium text-foreground">Looking for: </span>
                  {details.looking_for || "Someone interested"}
                </div>
                <div className="rounded-md bg-secondary/60 p-2">
                  <span className="font-medium text-foreground">Time: </span>
                  {details.time_availability || "Flexible"}
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href={`/project/${team.project_id}`}>View Spark Card</Link>
              </Button>
            </section>

            <section className="min-h-0 flex-1 rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chat</p>
              </div>

              <div className="space-y-1 overflow-y-auto">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md bg-primary px-3 py-2 text-left text-sm text-primary-foreground"
                >
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className="truncate">general</span>
                  <span className="ml-auto rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">main</span>
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" />
                Start panel
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{firstMove}</p>
              <div className="mt-3 space-y-2">
                {startSteps.map((step) => (
                  <div key={step} className="flex gap-2 rounded-md bg-background/70 p-2 text-xs leading-5 text-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 w-full bg-background/80"
                onClick={() => {
                  setIgniMode("plan")
                  setMessageInput("@igni Turn our Spark brief into the next 3 concrete steps. Keep it short and assign what to decide first.")
                }}
              >
                Ask Igni for next steps
              </Button>
            </section>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Hash className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    general
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    Chat, plan, and @igni when you need help.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAskingIgni && (
                  <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Igni thinking
                  </Badge>
                )}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Users className="h-4 w-4" />
                      People
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {memberCount}
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>People</SheetTitle>
                      <SheetDescription>Members in this Spark workspace.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      {ownerProfile && (
                        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={ownerProfile.avatar_url || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {getInitial(ownerProfile.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {ownerProfile.full_name || "Owner"}
                            </p>
                            <p className="text-xs text-muted-foreground">Started this Spark</p>
                          </div>
                        </div>
                      )}

                      {visibleMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.user?.avatar_url || ""} />
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {getInitial(member.user?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {member.user?.full_name || "Ignit user"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{member.role || "Interested"}</p>
                          </div>
                        </div>
                      ))}

                      {!ownerProfile && visibleMembers.length === 0 && (
                        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No one is in this workspace yet.
                        </p>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {!isWorkspaceMember && (
                <div className="mb-4 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center">
                  <p className="text-sm text-muted-foreground">This workspace opens after a Spark becomes a Match.</p>
                </div>
              )}

              {messages && messages.length > 0 ? (
                <div className="space-y-5">
                  {messages.map((message) => {
                    const messageIsIgni = isIgniReply(message.content)
                    const content = getMessageContent(message.content)

                    return (
                      <div
                        key={message.id}
                        className={`group flex gap-3 rounded-lg px-2 py-1.5 ${
                          messageIsIgni ? "border border-primary/15 bg-primary/5" : "hover:bg-secondary/30"
                        }`}
                      >
                        {messageIsIgni ? (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Bot className="h-4 w-4" />
                          </div>
                        ) : (
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={message.user?.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitial(message.user?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-medium text-foreground">
                              {messageIsIgni ? "Igni" : message.user?.full_name || "Ignit user"}
                            </span>
                            {messageIsIgni && message.user?.full_name && (
                              <span className="text-xs text-muted-foreground">via {message.user.full_name}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </span>
                          </div>

                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                            {content}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {isAskingIgni && (
                    <div className="flex gap-3 rounded-lg border border-primary/15 bg-primary/5 px-2 py-1.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">Igni</span>
                          <span className="text-xs text-muted-foreground">thinking</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Start the workspace</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Say hello, pick the first tiny step, or type @igni to ask for help.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {igniModes.map((mode) => {
                  const Icon = mode.icon
                  const active = igniMode === mode.id
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setIgniMode(mode.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mode.label}
                    </button>
                  )
                })}
                <span className="hidden text-xs text-muted-foreground sm:inline">Type @igni to use the selected mode.</span>
              </div>

              <div className="mb-2 flex flex-wrap gap-1.5">
                {igniPrompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => {
                      setIgniMode(prompt.mode)
                      setMessageInput(prompt.prompt)
                    }}
                    disabled={!isWorkspaceMember || isAskingIgni}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>

              {igniError && (
                <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{igniError}</p>
              )}
              {sendError && (
                <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{sendError}</p>
              )}
              {messagesError && (
                <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {messagesError.message || "Could not load messages."}
                </p>
              )}
              {setupError && (
                <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{setupError}</p>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <Input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder={
                    isWorkspaceMember && projectId
                      ? "Message #general or @igni plan our next step"
                      : "Workspace chat opens after a Match"
                  }
                  disabled={!isWorkspaceMember || !projectId || isSending}
                  className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageInput.trim() || !isWorkspaceMember || !projectId || isSending || isAskingIgni}
                  aria-label="Send message"
                >
                  {isSending || isAskingIgni ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
