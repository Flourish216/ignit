"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import useSWR, { mutate } from "swr"
import {
  ArrowLeft,
  Bot,
  ClipboardList,
  Edit3,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

type Channel = {
  id: string
  name: string
  description: string | null
  type: "text" | "voice" | "announcement"
  is_default: boolean
}

type Message = {
  id: string
  content: string
  created_at: string
  edited_at: string | null
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

type IgniTurn = {
  id: string
  mode: IgniMode
  question: string
  answer: string
  createdAt: string
}

const igniModes: Array<{ id: IgniMode; label: string; icon: typeof Wand2 }> = [
  { id: "plan", label: "Plan", icon: Wand2 },
  { id: "brainstorm", label: "Ideas", icon: Lightbulb },
  { id: "research", label: "Research", icon: Search },
  { id: "recap", label: "Recap", icon: MessageSquare },
]

const igniPrompts: Array<{ mode: IgniMode; label: string; prompt: string }> = [
  { mode: "plan", label: "This week", prompt: "Help us decide the first concrete thing to do this week." },
  { mode: "brainstorm", label: "Options", prompt: "Give us a few good ways to start this Spark and the tradeoffs." },
  { mode: "research", label: "What to check", prompt: "What should we look up or verify before we start?" },
  { mode: "recap", label: "Summarize", prompt: "Summarize the recent chat and list decisions, open questions, and next actions." },
]

const getInitial = (name?: string | null) => name?.trim()?.[0]?.toUpperCase() || "I"

const getStatusLabel = (status?: string, sparkStatus?: string) => {
  if (sparkStatus) return sparkStatus
  if (status === "recruiting") return "open"
  if (status === "in_progress") return "matched"
  return status || "open"
}

const cleanChannelName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")

const firstRelation = <T,>(relation: T | T[] | null | undefined) =>
  Array.isArray(relation) ? relation[0] || null : relation || null

export default function TeamWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDescription, setNewChannelDescription] = useState("")
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [igniMode, setIgniMode] = useState<IgniMode>("plan")
  const [igniQuestion, setIgniQuestion] = useState("")
  const [igniTurns, setIgniTurns] = useState<IgniTurn[]>([])
  const [isAskingIgni, setIsAskingIgni] = useState(false)
  const [igniError, setIgniError] = useState<string | null>(null)

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

  const { data: members } = useSWR(
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

  const { data: channels } = useSWR(
    teamId ? `channels-${teamId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, description, type, is_default")
        .eq("team_id", teamId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })

      if (error) throw error
      return data as Channel[]
    },
  )

  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannelId) {
      const defaultChannel = channels.find((channel) => channel.is_default) || channels[0]
      setSelectedChannelId(defaultChannel.id)
    }
  }, [channels, selectedChannelId])

  const activeChannelId = selectedChannelId || channels?.[0]?.id || null
  const selectedChannel = channels?.find((channel) => channel.id === activeChannelId) || channels?.[0] || null

  const { data: messages, mutate: mutateMessages } = useSWR(
    activeChannelId ? `messages-${activeChannelId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select(`
          id,
          content,
          created_at,
          edited_at,
          user_id,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq("channel_id", activeChannelId)
        .order("created_at", { ascending: true })
        .limit(100)

      if (error) throw error

      return (data as unknown as MessageRow[]).map((message) => ({
        ...message,
        user: firstRelation(message.user),
      }))
    },
  )

  useEffect(() => {
    if (!activeChannelId) return

    const subscription = supabase
      .channel(`workspace-channel-${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        () => {
          mutateMessages()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [activeChannelId, mutateMessages, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (user === null) {
      router.push(`/auth/login?redirect=/team/${teamId}`)
    }
  }, [router, teamId, user])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`igni-workspace-${teamId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setIgniTurns(parsed.slice(0, 8))
        }
      }
    } catch {
      setIgniTurns([])
    }
  }, [teamId])

  useEffect(() => {
    window.localStorage.setItem(`igni-workspace-${teamId}`, JSON.stringify(igniTurns.slice(0, 8)))
  }, [igniTurns, teamId])

  const isOwner = Boolean(user?.id && team?.project?.owner_id === user.id)
  const isWorkspaceMember = Boolean(
    user?.id && (isOwner || members?.some((member) => member.user_id === user.id)),
  )
  const details = (team?.project?.ai_breakdown || {}) as SparkBreakdown
  const sparkTitle = details.title || team?.project?.title || team?.name || "Spark"
  const sparkDescription = details.description || team?.project?.description || "No brief yet."
  const sparkStatus = getStatusLabel(team?.project?.status, details.status)
  const visibleMembers = members || []
  const memberCount = visibleMembers.length + (ownerProfile ? 1 : 0)
  const firstMove = details.time_availability
    ? `Find a time: ${details.time_availability}`
    : details.looking_for
      ? `Start with the person you were looking for: ${details.looking_for}`
      : "Agree on the first small thing you can do together."

  const handleSendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!messageInput.trim() || !activeChannelId || !user || !isWorkspaceMember) return

    setIsSending(true)
    const content = messageInput.trim()
    setMessageInput("")

    try {
      const { error } = await supabase.from("channel_messages").insert({
        channel_id: activeChannelId,
        user_id: user.id,
        content,
      })

      if (error) throw error
      mutateMessages()
    } catch (error) {
      console.error("Failed to send message:", error)
      setMessageInput(content)
    } finally {
      setIsSending(false)
    }
  }

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return

    try {
      const { error } = await supabase
        .from("channel_messages")
        .update({
          content: editContent.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId)

      if (error) throw error
      mutateMessages()
      setEditingMessageId(null)
      setEditContent("")
    } catch (error) {
      console.error("Failed to edit message:", error)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return

    try {
      const { error } = await supabase.from("channel_messages").delete().eq("id", messageId)

      if (error) throw error
      mutateMessages()
    } catch (error) {
      console.error("Failed to delete message:", error)
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user || !isOwner) return

    setIsCreatingChannel(true)
    try {
      const channelName = cleanChannelName(newChannelName) || "new-channel"
      const { error } = await supabase.from("channels").insert({
        team_id: teamId,
        name: channelName,
        description: newChannelDescription.trim() || null,
        type: "text",
        created_by: user.id,
      })

      if (error) throw error

      mutate(`channels-${teamId}`)
      setShowNewChannelDialog(false)
      setNewChannelName("")
      setNewChannelDescription("")
    } catch (error) {
      console.error("Failed to create channel:", error)
    } finally {
      setIsCreatingChannel(false)
    }
  }

  const handleAskIgni = async (override?: { question: string; mode: IgniMode }) => {
    const question = (override?.question || igniQuestion).trim()
    const mode = override?.mode || igniMode

    if (!question || !isWorkspaceMember) return

    setIsAskingIgni(true)
    setIgniError(null)
    if (!override) setIgniQuestion("")

    try {
      const response = await fetch("/api/ai/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          channelId: activeChannelId,
          question,
          mode,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      setIgniTurns((current) => [
        {
          id: `${Date.now()}`,
          mode,
          question,
          answer: data.answer,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 8))
    } catch (error) {
      setIgniError(error instanceof Error ? error.message : "Could not ask Igni")
      if (!override) setIgniQuestion(question)
    } finally {
      setIsAskingIgni(false)
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

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/teams"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to My Sparks
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace
              </Badge>
              <Badge variant="outline" className="capitalize">
                {sparkStatus}
              </Badge>
              {details.category && <Badge>{details.category}</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {sparkTitle}
            </h1>
          </div>

          <Button asChild variant="outline">
            <Link href={`/project/${team.project_id}`}>View Spark Card</Link>
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" />
                Spark brief
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{sparkDescription}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Looking for</p>
                  <p className="mt-1 text-foreground">{details.looking_for || "Someone interested"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                  <p className="mt-1 text-foreground">{details.time_availability || "Flexible"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vibe</p>
                  <p className="mt-1 text-foreground">{details.vibe || "Low-pressure start"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Channels</p>
                {isOwner && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setShowNewChannelDialog(true)}
                    aria-label="Create channel"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                {channels && channels.length > 0 ? (
                  channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        activeChannelId === channel.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Hash className="h-4 w-4 shrink-0" />
                      <span className="truncate">{channel.name}</span>
                      {channel.is_default && (
                        <span className="ml-auto rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
                          main
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border p-4 text-center">
                    <Hash className="mx-auto h-5 w-5 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">No channel yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create one to start the workspace.</p>
                    {isOwner && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowNewChannelDialog(true)}
                      >
                        Create Channel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </aside>

          <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {selectedChannel?.name || "general"}
                    </h2>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedChannel?.description || "Use this space to decide what happens next."}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                {memberCount} people
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {!isWorkspaceMember && (
                <div className="mb-4 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    This workspace opens after a Spark becomes a Match.
                  </p>
                </div>
              )}

              {messages && messages.length > 0 ? (
                <div className="space-y-5">
                  {messages.map((message) => {
                    const isOwnMessage = message.user_id === user.id

                    return (
                      <div key={message.id} className="group flex gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={message.user?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitial(message.user?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-medium text-foreground">
                              {message.user?.full_name || "Ignit user"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </span>
                            {message.edited_at && <span className="text-xs text-muted-foreground">edited</span>}
                          </div>

                          {editingMessageId === message.id ? (
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={editContent}
                                onChange={(event) => setEditContent(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") handleEditMessage(message.id)
                                  if (event.key === "Escape") {
                                    setEditingMessageId(null)
                                    setEditContent("")
                                  }
                                }}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleEditMessage(message.id)}>
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingMessageId(null)
                                    setEditContent("")
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                              {message.content}
                            </p>
                          )}
                        </div>

                        {isOwnMessage && editingMessageId !== message.id && (
                          <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingMessageId(message.id)
                                setEditContent(message.content)
                              }}
                              aria-label="Edit message"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteMessage(message.id)}
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Start the workspace</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Say hello, pick the first tiny step, and make the Spark real.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-border p-3">
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <Input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder={
                    isWorkspaceMember && activeChannelId
                      ? `Message #${selectedChannel?.name || "general"}`
                      : "Workspace chat opens after a Match"
                  }
                  disabled={!isWorkspaceMember || !activeChannelId || isSending}
                  className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageInput.trim() || !isWorkspaceMember || !activeChannelId || isSending}
                  aria-label="Send message"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="h-4 w-4 text-primary" />
                People
              </div>

              <div className="mt-4 space-y-3">
                {ownerProfile && (
                  <div className="flex items-center gap-3">
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
                  <div key={member.id} className="flex items-center gap-3">
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
                  <p className="text-sm text-muted-foreground">No one is in this workspace yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-primary/25 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Bot className="h-4 w-4 text-primary" />
                    Ask Igni
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Reads this Spark, people, and recent chat.
                  </p>
                </div>
                <Badge variant="secondary">AI</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-1.5">
                {igniModes.map((mode) => {
                  const Icon = mode.icon
                  const active = igniMode === mode.id
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setIgniMode(mode.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
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
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {igniPrompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => {
                      setIgniMode(prompt.mode)
                      handleAskIgni({ question: prompt.prompt, mode: prompt.mode })
                    }}
                    disabled={!isWorkspaceMember || isAskingIgni}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>

              <form
                className="mt-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleAskIgni()
                }}
              >
                <Textarea
                  value={igniQuestion}
                  onChange={(event) => setIgniQuestion(event.target.value)}
                  placeholder="Ask Igni to plan, research, recap, or brainstorm..."
                  disabled={!isWorkspaceMember || isAskingIgni}
                  className="min-h-24 resize-none text-sm"
                />
                {igniError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {igniError}
                  </p>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="w-full gap-2"
                  disabled={!igniQuestion.trim() || !isWorkspaceMember || isAskingIgni}
                >
                  {isAskingIgni ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Ask Igni
                </Button>
              </form>

              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {igniTurns.length > 0 ? (
                  igniTurns.map((turn) => (
                    <div key={turn.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {turn.mode}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(turn.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-5 text-foreground">{turn.question}</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {turn.answer}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <Bot className="mx-auto h-5 w-5 text-primary" />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Ask for a plan, a recap, or what to verify before starting.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                First move
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">{firstMove}</p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 accent-primary" />
                  <span>Say what you can do this week.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 accent-primary" />
                  <span>Pick one concrete next step.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 accent-primary" />
                  <span>Decide when to start.</span>
                </label>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <Dialog open={showNewChannelDialog} onOpenChange={setShowNewChannelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create channel</DialogTitle>
            <DialogDescription>
              Add a focused space for planning, links, or a specific part of this Spark.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Channel name</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={newChannelName}
                  onChange={(event) => setNewChannelName(event.target.value)}
                  placeholder="planning"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Description</label>
              <Input
                value={newChannelDescription}
                onChange={(event) => setNewChannelDescription(event.target.value)}
                placeholder="What should people use this for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewChannelDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateChannel} disabled={!newChannelName.trim() || isCreatingChannel}>
              {isCreatingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
