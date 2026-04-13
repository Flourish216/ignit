"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, MessageSquare, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDistanceToNow } from "date-fns"

interface Message {
  id: string
  project_id: string
  user_id: string
  content: string
  created_at: string
  user?: {
    full_name: string
    avatar_url: string | null
  }
}

interface ProjectChatProps {
  projectId: string
  userId: string | undefined
  isMember: boolean // 是否是团队成员（owner 或 active member）
}

export function ProjectChat({ projectId, userId, isMember }: ProjectChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 加载历史消息
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          user:profiles!messages_user_id_fkey(full_name, avatar_url)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(100)

      if (error) {
        console.error("Error loading messages:", error)
      } else {
        setMessages(data || [])
      }
      setIsLoading(false)
    }

    loadMessages()
  }, [projectId, supabase])

  // 订阅实时消息
  useEffect(() => {
    const channel = supabase
      .channel(`project-messages-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          console.log(" realtime message received:", payload)
          const newMsg = payload.new as Message
          // 获取发送者信息
          const { data: userData } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", newMsg.user_id)
            .single()

          setMessages((prev) => [
            ...prev,
            { ...newMsg, user: userData || undefined },
          ])
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, supabase])

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userId || !isMember) return

    setIsSending(true)
    const { error } = await supabase.from("messages").insert({
      project_id: projectId,
      user_id: userId,
      content: newMessage.trim(),
    })

    if (error) {
      console.error("Error sending message:", error)
      alert("Failed to send: " + error.message)
    } else {
      setNewMessage("")
    }
    setIsSending(false)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Team Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" />
          Team Chat
          {messages.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({messages.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 消息列表 */}
        <ScrollArea className="h-64 pr-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No messages yet</p>
                {isMember && <p className="text-xs mt-1">Start the conversation!</p>}
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.user_id === userId
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={msg.user?.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {msg.user?.full_name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[calc(100%-2.5rem)]`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {msg.user?.full_name || "Anonymous"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div
                        className={`mt-0.5 rounded-lg px-3 py-1.5 text-sm ${
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* 输入框 */}
        {isMember ? (
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        ) : userId ? (
          <div className="text-center py-2 text-xs text-muted-foreground bg-secondary/50 rounded">
            Join the team to participate in chat
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-muted-foreground bg-secondary/50 rounded">
            Sign in to view and send messages
          </div>
        )}
      </CardContent>
    </Card>
  )
}
