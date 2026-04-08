"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import useSWR, { mutate } from "swr"
import { formatDistanceToNow } from "date-fns"
import { 
  Hash, 
  Settings, 
  Plus, 
  Send, 
  MoreVertical,
  ChevronDown,
  Loader2,
  ArrowLeft,
  User,
  Mic,
  Headphones,
  Phone,
  Video,
  AtSign,
  Smile,
  Paperclip,
  Edit3,
  Trash2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"

type Channel = {
  id: string
  name: string
  description: string | null
  type: 'text' | 'voice' | 'announcement'
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
    full_name: string
    avatar_url: string | null
  }
}

type TeamMember = {
  id: string
  user_id: string
  role: string
  status: string
  user?: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

export default function TeamWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDescription, setNewChannelDescription] = useState("")
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)

  // Get current user
  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  }, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  // Get team info
  const { data: team } = useSWR(
    teamId ? `team-${teamId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("teams")
        .select(`
          *,
          project:projects(id, title, owner_id)
        `)
        .eq("id", teamId)
        .single()
      
      if (error) throw error
      return data
    }
  )

  // Get team members
  const { data: members } = useSWR(
    teamId ? `team-members-${teamId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq("team_id", teamId)
        .eq("status", "active")
      
      if (error) throw error
      return data as TeamMember[]
    }
  )

  // Get channels
  const { data: channels } = useSWR(
    teamId ? `channels-${teamId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("team_id", teamId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
      
      if (error) throw error
      return data as Channel[]
    }
  )

  // Auto-select default channel
  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannelId) {
      const defaultChannel = channels.find(c => c.is_default) || channels[0]
      setSelectedChannelId(defaultChannel.id)
    }
  }, [channels, selectedChannelId])

  // Get messages for selected channel
  const { data: messages, mutate: mutateMessages } = useSWR(
    selectedChannelId ? `messages-${selectedChannelId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq("channel_id", selectedChannelId)
        .order("created_at", { ascending: true })
        .limit(100)
      
      if (error) throw error
      return data as Message[]
    }
  )

  // Subscribe to new messages
  useEffect(() => {
    if (!selectedChannelId) return

    const subscription = supabase
      .channel(`channel-${selectedChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${selectedChannelId}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          mutateMessages((current) => {
            if (!current) return [newMessage]
            if (current.find(m => m.id === newMessage.id)) return current
            return [...current, newMessage]
          }, false)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [selectedChannelId, supabase, mutateMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Check if user is team member
  const isTeamMember = user && (
    team?.project?.owner_id === user.id ||
    members?.some(m => m.user_id === user.id)
  )

  const isOwner = user?.id === team?.project?.owner_id

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!messageInput.trim() || !selectedChannelId || !user) return

    setIsSending(true)
    const content = messageInput.trim()
    setMessageInput("")

    try {
      const { error } = await supabase
        .from("channel_messages")
        .insert({
          channel_id: selectedChannelId,
          user_id: user.id,
          content: content,
        })

      if (error) throw error
    } catch (err) {
      console.error("Failed to send message:", err)
      setMessageInput(content) // Restore input on error
    } finally {
      setIsSending(false)
    }
  }

  // Edit message
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
    } catch (err) {
      console.error("Failed to edit message:", err)
    }
  }

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return

    try {
      const { error } = await supabase
        .from("channel_messages")
        .delete()
        .eq("id", messageId)

      if (error) throw error
      mutateMessages()
    } catch (err) {
      console.error("Failed to delete message:", err)
    }
  }

  // Create new channel
  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return

    setIsCreatingChannel(true)
    try {
      const { error } = await supabase
        .from("channels")
        .insert({
          team_id: teamId,
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          description: newChannelDescription.trim() || null,
          type: 'text',
          created_by: user.id,
        })

      if (error) throw error

      mutate(`channels-${teamId}`)
      setShowNewChannelDialog(false)
      setNewChannelName("")
      setNewChannelDescription("")
    } catch (err) {
      console.error("Failed to create channel:", err)
    } finally {
      setIsCreatingChannel(false)
    }
  }

  // Loading state
  if (userLoading || user === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#313338]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  if (user === null) {
    router.push(`/auth/login?redirect=/team/${teamId}`)
    return null
  }

  const selectedChannel = channels?.find(c => c.id === selectedChannelId)

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-[#313338] text-gray-100 overflow-hidden">
        {/* Left Sidebar - Server/Team List */}
        <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 flex-shrink-0">
          {/* Home button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/teams">
                <button className="w-12 h-12 rounded-full bg-[#313338] hover:bg-[#5865f2] hover:rounded-2xl transition-all flex items-center justify-center group">
                  <ArrowLeft className="w-6 h-6 text-[#23a559] group-hover:text-white" />
                </button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Back to Teams</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-8 h-[2px] bg-[#35363c] rounded-full my-1" />

          {/* Current Team */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <div className="w-12 h-12 rounded-[16px] bg-[#5865f2] flex items-center justify-center text-white font-bold text-lg cursor-pointer hover:rounded-xl transition-all">
                  {team?.project?.title?.[0]?.toUpperCase() || "T"}
                </div>
                <div className="absolute -right-1 -bottom-1 w-4 h-4 bg-[#23a559] rounded-full border-2 border-[#1e1f22]" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{team?.project?.title || "Team"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Channel List Sidebar */}
        <div className="w-60 bg-[#2b2d31] flex flex-col flex-shrink-0">
          {/* Team Header */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm">
            <h2 className="font-semibold text-white truncate">
              {team?.project?.title || "Team"}
            </h2>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* Text Channels Header */}
            <div className="px-4 py-1 flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300 cursor-pointer">
              <ChevronDown className="w-3 h-3" />
              Text Channels
            </div>

            {/* Channel Items */}
            <div className="mt-1 space-y-0.5 px-2">
              {channels?.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    selectedChannelId === channel.id
                      ? "bg-[#404249] text-white"
                      : "text-gray-400 hover:bg-[#35373c] hover:text-gray-200"
                  }`}
                >
                  <Hash className="w-5 h-5 text-gray-400" />
                  <span className="truncate">{channel.name}</span>
                  {channel.is_default && (
                    <Badge variant="secondary" className="ml-auto text-[10px] bg-[#5865f2]/20 text-[#5865f2] border-0">
                      Default
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Add Channel Button (Owner/Admin only) */}
            {isOwner && (
              <button
                onClick={() => setShowNewChannelDialog(true)}
                className="mt-2 mx-4 flex items-center gap-2 px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Channel
              </button>
            )}
          </div>

          {/* User Panel */}
          <div className="h-[52px] bg-[#232428] px-2 flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-[#5865f2] text-white text-xs">
                {user.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </p>
              <p className="text-xs text-gray-400 truncate">Online</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 hover:bg-[#35363c] rounded text-gray-400 hover:text-white">
                <Mic className="w-5 h-5" />
              </button>
              <button className="p-1.5 hover:bg-[#35363c] rounded text-gray-400 hover:text-white">
                <Headphones className="w-5 h-5" />
              </button>
              <button className="p-1.5 hover:bg-[#35363c] rounded text-gray-400 hover:text-white">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
          {/* Channel Header */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <Hash className="w-6 h-6 text-gray-400" />
              <div>
                <h3 className="font-semibold text-white">
                  {selectedChannel?.name || "general"}
                </h3>
                {selectedChannel?.description && (
                  <p className="text-xs text-gray-400">{selectedChannel.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <button className="hover:text-white transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button className="hover:text-white transition-colors">
                <Video className="w-5 h-5" />
              </button>
              <button className="hover:text-white transition-colors">
                <AtSign className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-[#1e1f22]" />
              <button className="hover:text-white transition-colors">
                <User className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!isTeamMember && (
              <div className="bg-[#2b2d31] rounded-lg p-4 text-center">
                <p className="text-gray-400">
                  You need to join this team to participate in the conversation.
                </p>
              </div>
            )}

            {messages?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Hash className="w-16 h-16 mb-4 text-gray-600" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Welcome to #{selectedChannel?.name || "general"}!
                </h3>
                <p className="text-sm">This is the start of the channel.</p>
              </div>
            ) : (
              messages?.map((message, index) => {
                const prevMessage = messages[index - 1]
                const isCompact = prevMessage && 
                  prevMessage.user_id === message.user_id &&
                  new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 600000 // 10 minutes

                const isOwnMessage = message.user_id === user.id

                if (isCompact) {
                  return (
                    <div key={message.id} className="group flex gap-4 hover:bg-[#2e3035]/50 rounded px-2 -mx-2">
                      <div className="w-10 flex-shrink-0 text-right">
                        <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingMessageId === message.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="flex-1 bg-[#383a40] border-0 text-white"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditMessage(message.id)
                                if (e.key === 'Escape') {
                                  setEditingMessageId(null)
                                  setEditContent("")
                                }
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={() => handleEditMessage(message.id)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditingMessageId(null)
                              setEditContent("")
                            }}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="text-gray-200 whitespace-pre-wrap break-words">{message.content}</p>
                            {message.edited_at && (
                              <span className="text-[10px] text-gray-500">(edited)</span>
                            )}
                          </div>
                        )}
                      </div>
                      {isOwnMessage && editingMessageId !== message.id && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={() => {
                              setEditingMessageId(message.id)
                              setEditContent(message.content)
                            }}
                            className="p-1 hover:bg-[#404249] rounded text-gray-400 hover:text-white"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="p-1 hover:bg-[#404249] rounded text-gray-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div key={message.id} className="group flex gap-4 pt-2 hover:bg-[#2e3035]/50 rounded px-2 -mx-2">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={message.user?.avatar_url || ""} />
                      <AvatarFallback className="bg-[#5865f2] text-white">
                        {message.user?.full_name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white hover:underline cursor-pointer">
                          {message.user?.full_name || "Unknown User"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {editingMessageId === message.id ? (
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 bg-[#383a40] border-0 text-white"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditMessage(message.id)
                              if (e.key === 'Escape') {
                                setEditingMessageId(null)
                                setEditContent("")
                              }
                            }}
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleEditMessage(message.id)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditingMessageId(null)
                            setEditContent("")
                          }}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <p className="text-gray-200 whitespace-pre-wrap break-words">{message.content}</p>
                          {message.edited_at && (
                            <span className="text-[10px] text-gray-500">(edited)</span>
                          )}
                        </div>
                      )}
                    </div>
                    {isOwnMessage && editingMessageId !== message.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={() => {
                            setEditingMessageId(message.id)
                            setEditContent(message.content)
                          }}
                          className="p-1 hover:bg-[#404249] rounded text-gray-400 hover:text-white"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="p-1 hover:bg-[#404249] rounded text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="px-4 pb-6 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="bg-[#383a40] rounded-lg flex items-end gap-2 p-3">
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-white hover:bg-[#404249] rounded-full transition-colors flex-shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={isTeamMember 
                    ? `Message #${selectedChannel?.name || "general"}` 
                    : "Join the team to send messages"
                  }
                  disabled={!isTeamMember || isSending}
                  className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none min-h-[24px] max-h-[200px] resize-none disabled:cursor-not-allowed"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#404249] rounded-full transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#404249] rounded-full transition-colors"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || !isTeamMember || isSending}
                    className="p-2 text-[#5865f2] hover:bg-[#5865f2]/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Sidebar - Members List */}
        <div className="w-60 bg-[#2b2d31] hidden lg:flex flex-col flex-shrink-0">
          <div className="h-12 px-4 flex items-center border-b border-[#1e1f22]">
            <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">
              Members — {members?.length || 0}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {/* Owner */}
            {team?.project?.owner_id && (
              <div className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer group">
                <div className="relative">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={members?.find(m => m.user_id === team.project.owner_id)?.user?.avatar_url || ""} />
                    <AvatarFallback className="bg-[#f59e0b] text-white text-xs">
                      {members?.find(m => m.user_id === team.project.owner_id)?.user?.full_name?.[0]?.toUpperCase() || "O"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#2b2d31]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate group-hover:text-gray-200">
                    {members?.find(m => m.user_id === team.project.owner_id)?.user?.full_name || "Owner"}
                  </p>
                  <p className="text-xs text-[#f59e0b]">Owner</p>
                </div>
              </div>
            )}

            {/* Members */}
            {members?.filter(m => m.user_id !== team?.project?.owner_id).map((member) => (
              <div 
                key={member.id} 
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer group"
              >
                <div className="relative">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={member.user?.avatar_url || ""} />
                    <AvatarFallback className="bg-[#5865f2] text-white text-xs">
                      {member.user?.full_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#2b2d31]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate group-hover:text-white">
                    {member.user?.full_name || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* New Channel Dialog */}
        <Dialog open={showNewChannelDialog} onOpenChange={setShowNewChannelDialog}>
          <DialogContent className="bg-[#313338] border-[#1e1f22] text-white">
            <DialogHeader>
              <DialogTitle>Create Channel</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new text channel for your team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Channel Name
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="new-channel"
                    className="pl-9 bg-[#1e1f22] border-[#1e1f22] text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <Input
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  className="bg-[#1e1f22] border-[#1e1f22] text-white placeholder-gray-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowNewChannelDialog(false)}
                className="text-gray-300 hover:text-white hover:bg-[#404249]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim() || isCreatingChannel}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white"
              >
                {isCreatingChannel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create Channel"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
