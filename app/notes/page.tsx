"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { Archive, Check, Edit3, Loader2, Mic, NotebookPen, Sparkles, Type, Wand2, X } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { QuickNoteDialog } from "@/components/quick-note-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/i18n/context"
import { zhCN } from "date-fns/locale"

type Note = {
  id: string
  user_id: string
  content: string
  source: "text" | "voice"
  converted_project_id: string | null
  archived_at?: string | null
  created_at: string
  updated_at: string
}

type ShapedNote = {
  noteId: string
  result: {
    title?: string
    category?: string
    description?: string
    looking_for?: string
    time_availability?: string
  }
}

const getNoteErrorMessage = (error: unknown) => {
  const errorObject = error && typeof error === "object" ? error as Record<string, unknown> : null
  const message = [
    error instanceof Error ? error.message : null,
    typeof errorObject?.message === "string" ? errorObject.message : null,
    typeof errorObject?.code === "string" ? errorObject.code : null,
    typeof errorObject?.details === "string" ? errorObject.details : null,
  ].filter(Boolean).join(" ")

  if (message.includes("archived_at")) {
    return "灵感归档字段还没准备好。请在 Supabase 里运行最新的 scripts/create-notes-table.sql。"
  }
  if (message.includes("public.notes") || message.includes("schema cache") || message.includes("PGRST205")) {
    return "灵感表还没准备好。请先在 Supabase 里运行 scripts/create-notes-table.sql。"
  }
  return message || "灵感加载失败。"
}

const isMissingArchiveColumn = (error: unknown) => {
  const errorObject = error && typeof error === "object" ? error as Record<string, unknown> : null
  const message = [
    error instanceof Error ? error.message : null,
    typeof errorObject?.message === "string" ? errorObject.message : null,
    typeof errorObject?.details === "string" ? errorObject.details : null,
  ].filter(Boolean).join(" ")
  return message.includes("archived_at")
}

export default function NotesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { language } = useLanguage()
  const isZh = language === "zh"
  const [shapingNoteId, setShapingNoteId] = useState<string | null>(null)
  const [shapedNote, setShapedNote] = useState<ShapedNote | null>(null)
  const [shapeError, setShapeError] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user ?? null
  })

  const {
    data: notes,
    error,
    isLoading,
    mutate,
  } = useSWR(
    user ? `notes-${user.id}` : null,
    async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, user_id, content, source, converted_project_id, archived_at, created_at, updated_at")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })

      if (isMissingArchiveColumn(error)) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("notes")
          .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })

        if (fallbackError) throw fallbackError
        return fallbackData as Note[]
      }
      if (error) throw error
      return data as Note[]
    },
    { shouldRetryOnError: false },
  )

  const handleArchive = async (noteId: string) => {
    const { error } = await supabase
      .from("notes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", noteId)
      .eq("user_id", user!.id)
    if (error) {
      setShapeError(getNoteErrorMessage(error))
      return
    }
    mutate((current = []) => current.filter((note) => note.id !== noteId), false)
  }

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id)
    setEditContent(note.content)
    setShapeError(null)
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditContent("")
  }

  const handleSaveEdit = async (note: Note) => {
    const text = editContent.trim()
    if (!text || !user) return

    setIsSavingEdit(true)
    setShapeError(null)

    try {
      const { data, error } = await supabase
        .from("notes")
        .update({ content: text })
        .eq("id", note.id)
        .eq("user_id", user.id)
        .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
        .single()

      if (error) throw error

      mutate((current = []) => current.map((currentNote) => currentNote.id === note.id ? data as Note : currentNote), false)
      setShapedNote((current) => current?.noteId === note.id ? null : current)
      handleCancelEdit()
    } catch (error) {
      setShapeError(error instanceof Error ? error.message : "灵感保存失败。")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleTurnIntoSpark = (content: string) => {
    router.push(`/create?idea=${encodeURIComponent(content)}`)
  }

  const handleShapeNote = async (note: Note) => {
    setShapingNoteId(note.id)
    setShapedNote(null)
    setShapeError(null)

    try {
      const response = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: note.content }),
      })

      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setShapedNote({ noteId: note.id, result: data.result || {} })
    } catch (error) {
      setShapeError(error instanceof Error ? error.message : "Igni 暂时没整理成功。")
    } finally {
      setShapingNoteId(null)
    }
  }

  if (userLoading || user === undefined) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!user) {
    router.push("/auth/login?redirect=/notes")
    return null
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
              <NotebookPen className="h-4 w-4" />
              {isZh ? "灵感收件箱" : "Idea inbox"}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{isZh ? "灵感" : "Notes"}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {isZh ? "把还没成形的想法先放在这里，准备好了再变成 Spark。" : "Keep rough thoughts here before they become Sparks."}
            </p>
          </div>
          <QuickNoteDialog label={isZh ? "新灵感" : "New note"} />
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-6">
              <p className="text-sm text-destructive">{getNoteErrorMessage(error)}</p>
            </CardContent>
          </Card>
        )}

        {shapeError && (
          <Card className="mb-4 border-destructive/30 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{shapeError}</p>
            </CardContent>
          </Card>
        )}

        {isLoading && !notes && (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}

        {notes && notes.length > 0 && (
          <div className="space-y-3">
            {notes.map((note) => {
              const SourceIcon = note.source === "voice" ? Mic : Type
              return (
                <Card key={note.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="gap-1">
                            <SourceIcon className="h-3 w-3" />
                            {isZh ? note.source === "voice" ? "语音" : "文字" : note.source}
                          </Badge>
                          <span>
                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: isZh ? zhCN : undefined })}
                          </span>
                        </div>
                        {editingNoteId === note.id ? (
                          <Textarea
                            value={editContent}
                            onChange={(event) => setEditContent(event.target.value)}
                            className="min-h-28 text-sm leading-7"
                            autoFocus
                          />
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                            {note.content}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {editingNoteId === note.id ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleSaveEdit(note)}
                              disabled={!editContent.trim() || isSavingEdit}
                            >
                              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              {isZh ? "保存" : "Save"}
                            </Button>
                            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                              {isZh ? "取消" : "Cancel"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => handleStartEdit(note)}
                            >
                              <Edit3 className="h-4 w-4" />
                              {isZh ? "编辑" : "Edit"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => handleShapeNote(note)}
                              disabled={shapingNoteId === note.id}
                            >
                              {shapingNoteId === note.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Wand2 className="h-4 w-4" />
                              )}
                              {isZh ? "整理" : "Shape"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleTurnIntoSpark(note.content)}
                            >
                              <Sparkles className="h-4 w-4" />
                              {isZh ? "变成 Spark" : "Spark"}
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-muted-foreground hover:text-foreground"
                          onClick={() => handleArchive(note.id)}
                          disabled={editingNoteId === note.id}
                          aria-label={isZh ? "归档灵感" : "Archive note"}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {shapedNote?.noteId === note.id && (
                      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Sparkles className="h-4 w-4" />
                          {isZh ? "Igni 整理了这条灵感" : "Igni shaped this note"}
                        </div>
                        <p className="mt-3 text-base font-semibold text-foreground">
                          {shapedNote.result.title || (isZh ? "未命名 Spark" : "Untitled Spark")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {shapedNote.result.description || note.content}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {shapedNote.result.category && <Badge variant="secondary">{shapedNote.result.category}</Badge>}
                          {shapedNote.result.looking_for && <Badge variant="outline">{shapedNote.result.looking_for}</Badge>}
                          {shapedNote.result.time_availability && <Badge variant="outline">{shapedNote.result.time_availability}</Badge>}
                        </div>
                        <Button className="mt-4" size="sm" onClick={() => handleTurnIntoSpark(note.content)}>
                          {isZh ? "用它创建 Spark" : "Create Spark from this"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {notes && notes.length === 0 && !error && (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <NotebookPen className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">{isZh ? "还没有灵感" : "No notes yet"}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {isZh ? "先记下一句话、一段语音，或者一个还没想清楚的念头。之后可以再变成 Spark。" : "Capture a sentence, voice thought, or half-formed idea. You can turn it into a Spark later."}
              </p>
              <div className="mt-5">
                <QuickNoteDialog label={isZh ? "记录第一条灵感" : "Capture first note"} />
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
