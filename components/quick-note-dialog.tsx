"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR, { mutate } from "swr"
import { Archive, Check, Edit3, Lightbulb, Loader2, Mic, MicOff, NotebookPen, Plus, Sparkles, Wand2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"

type NoteSource = "text" | "voice"

type QuickNote = {
  id: string
  user_id: string
  content: string
  source: NoteSource
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

type QuickNoteDialogProps = {
  compact?: boolean
  label?: string
  iconOnly?: boolean
}

type SpeechRecognitionConstructor = new () => SpeechRecognition

type SpeechRecognition = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

type SpeechRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: {
      transcript: string
    }
  }>
}

type SpeechRecognitionErrorEvent = {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const getRecognition = () => {
  if (typeof window === "undefined") return null
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  return Recognition ? new Recognition() : null
}

const formatDate = (value: string, isZh = false) =>
  new Intl.DateTimeFormat(isZh ? "zh-CN" : undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const getNoteErrorMessage = (error: unknown, isZh = false) => {
  const errorObject = error && typeof error === "object" ? error as Record<string, unknown> : null
  const message = [
    error instanceof Error ? error.message : null,
    typeof errorObject?.message === "string" ? errorObject.message : null,
    typeof errorObject?.code === "string" ? errorObject.code : null,
    typeof errorObject?.details === "string" ? errorObject.details : null,
  ].filter(Boolean).join(" ")

  if (message.includes("archived_at")) {
    return isZh ? "灵感归档字段还没准备好。请在 Supabase 里运行最新的 notes 脚本。" : "Notes archive is not ready yet. Run the updated scripts/create-notes-table.sql in Supabase."
  }
  if (message.includes("public.notes") || message.includes("schema cache") || message.includes("PGRST205")) {
    return isZh ? "灵感表还没准备好。请先在 Supabase 里运行 notes 脚本。" : "Notes storage is not ready yet. Run scripts/create-notes-table.sql in Supabase."
  }
  return message || (isZh ? "保存失败，请再试一次。" : "Could not save note.")
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

export function QuickNoteDialog({ compact = false, label = "Quick note", iconOnly = false }: QuickNoteDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const { language } = useLanguage()
  const isZh = language === "zh"
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef("")

  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [source, setSource] = useState<NoteSource>("text")
  const [error, setError] = useState<string | null>(null)
  const [shapingNoteId, setShapingNoteId] = useState<string | null>(null)
  const [shapedNote, setShapedNote] = useState<ShapedNote | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [isUpdatingNote, setIsUpdatingNote] = useState(false)

  const { data: user } = useSWR("user", async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user ?? null
  })

  const notesKey = user ? `quick-notes-${user.id}` : null
  const { data: notes, error: notesError, mutate: mutateNotes } = useSWR(
    open && notesKey ? notesKey : null,
    async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from("notes")
        .select("id, user_id, content, source, converted_project_id, archived_at, created_at, updated_at")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5)

      if (isMissingArchiveColumn(error)) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("notes")
          .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)

        if (fallbackError) throw fallbackError
        return fallbackData as QuickNote[]
      }
      if (error) throw error
      return data as QuickNote[]
    },
    { shouldRetryOnError: false },
  )

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [open])

  useEffect(() => {
    if (!open && recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
      setIsListening(false)
    }
  }, [open])

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }

  const startListening = () => {
    if (!speechSupported) {
      setError(isZh ? "这个浏览器暂时不支持语音输入。" : "Voice input is not supported in this browser.")
      return
    }

    if (isListening) {
      stopListening()
      return
    }

    const recognition = getRecognition()
    if (!recognition) return

    setError(null)
    setSource("voice")
    finalTranscriptRef.current = content.trim()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = isZh ? "zh-CN" : navigator.language || "en-US"

    recognition.onresult = (event) => {
      let interim = ""
      let finalText = finalTranscriptRef.current

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript
        if (event.results[index].isFinal) {
          finalText = `${finalText} ${transcript}`.trim()
        } else {
          interim = `${interim} ${transcript}`.trim()
        }
      }

      finalTranscriptRef.current = finalText
      setContent([finalText, interim].filter(Boolean).join(" ").trim())
    }

    recognition.onerror = (event) => {
      setError(event.error === "not-allowed"
        ? isZh ? "麦克风权限被浏览器拦截了。" : "Microphone permission was blocked."
        : isZh ? "语音输入中断了。" : "Voice input stopped.")
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const handleSave = async () => {
    const text = content.trim()
    if (!text) return

    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent("/notes")}`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          content: text,
          source,
        })
        .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
        .single()

      if (error) throw error
      if (data) {
        mutateNotes((current = []) => [data as QuickNote, ...current], false)
        mutate(notesKey)
        mutate(`notes-${user.id}`)
      }
      setContent("")
      setSource("text")
    } catch (error) {
      setError(getNoteErrorMessage(error, isZh))
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async (noteId: string) => {
    if (!user) return
    const { error } = await supabase
      .from("notes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", noteId)
      .eq("user_id", user.id)
    if (error) {
      setError(getNoteErrorMessage(error, isZh))
      return
    }
    mutateNotes((current = []) => current.filter((note) => note.id !== noteId), false)
    if (editingNoteId === noteId) {
      setEditingNoteId(null)
      setEditContent("")
    }
  }

  const handleStartEdit = (note: QuickNote) => {
    setEditingNoteId(note.id)
    setEditContent(note.content)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditContent("")
  }

  const handleSaveEdit = async (note: QuickNote) => {
    const text = editContent.trim()
    if (!text || !user) return

    setIsUpdatingNote(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("notes")
        .update({ content: text })
        .eq("id", note.id)
        .eq("user_id", user.id)
        .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
        .single()

      if (error) throw error
      if (data) {
        mutateNotes((current = []) => current.map((currentNote) => currentNote.id === note.id ? data as QuickNote : currentNote), false)
        mutate(`notes-${user.id}`)
      }
      setShapedNote((current) => current?.noteId === note.id ? null : current)
      handleCancelEdit()
    } catch (error) {
      setError(getNoteErrorMessage(error, isZh))
    } finally {
      setIsUpdatingNote(false)
    }
  }

  const handleShapeNote = async (note: QuickNote) => {
    setShapingNoteId(note.id)
    setShapedNote(null)
    setError(null)

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
      setError(error instanceof Error ? error.message : isZh ? "Igni 暂时没整理成功。" : "Could not shape note.")
    } finally {
      setShapingNoteId(null)
    }
  }

  const handleTurnIntoSpark = (noteContent: string) => {
    setOpen(false)
    router.push(`/create?idea=${encodeURIComponent(noteContent)}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "sm"}
          className={cn(!iconOnly && "gap-2", compact && "h-9 w-9 p-0")}
          aria-label={label}
        >
          {iconOnly || compact ? <NotebookPen className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {!iconOnly && !compact && label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            {isZh ? "随心记" : "Quick note"}
          </DialogTitle>
          <DialogDescription>
            {isZh ? "先把粗糙想法记下来，准备好了再变成 Spark。" : "Capture a rough thought now. Turn it into a Spark when it is ready."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <Textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value)
                if (!isListening) setSource("text")
              }}
              placeholder={isZh ? "记录一个想法、计划、地点，或者想一起开始的人..." : "Record an idea, plan, place, or person you want to start with..."}
              className="min-h-32 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isListening ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={startListening}
                  disabled={!speechSupported}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isListening ? isZh ? "停止" : "Stop" : isZh ? "语音" : "Voice"}
                </Button>
                {source === "voice" && <Badge variant="secondary">{isZh ? "语音" : "voice"}</Badge>}
                {!speechSupported && (
                  <span className="text-xs text-muted-foreground">{isZh ? "当前浏览器不支持语音输入。" : "Voice works in supported browsers."}</span>
                )}
              </div>
              <Button type="button" onClick={handleSave} disabled={!content.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isZh ? "保存" : "Save"}
              </Button>
            </div>
          </div>

          {(error || notesError) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error || getNoteErrorMessage(notesError, isZh)}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{isZh ? "最近记录" : "Recent notes"}</p>
              <Button asChild variant="ghost" size="sm">
                <Link href="/notes" onClick={() => setOpen(false)}>
                  {isZh ? "查看全部" : "View all"}
                </Link>
              </Button>
            </div>

            {notes && notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {editingNoteId === note.id ? (
                          <Textarea
                            value={editContent}
                            onChange={(event) => setEditContent(event.target.value)}
                            className="min-h-24 text-sm leading-6"
                            autoFocus
                          />
                        ) : (
                          <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {note.content}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(note.created_at, isZh)}</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {isZh ? note.source === "voice" ? "语音" : "文字" : note.source}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {editingNoteId === note.id ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSaveEdit(note)}
                              disabled={!editContent.trim() || isUpdatingNote}
                              aria-label={isZh ? "保存灵感" : "Save note"}
                            >
                              {isUpdatingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleCancelEdit}
                              aria-label={isZh ? "取消编辑" : "Cancel edit"}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleStartEdit(note)}
                              aria-label={isZh ? "编辑灵感" : "Edit note"}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleShapeNote(note)}
                              disabled={shapingNoteId === note.id}
                              aria-label={isZh ? "让 Igni 整理" : "Shape with Igni"}
                            >
                              {shapingNoteId === note.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Wand2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleTurnIntoSpark(note.content)}
                              aria-label={isZh ? "变成 Spark" : "Turn into Spark"}
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleArchive(note.id)}
                              aria-label={isZh ? "归档灵感" : "Archive note"}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {shapedNote?.noteId === note.id && (
                      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                          {isZh ? "Igni 整理好了" : "Igni shaped this"}
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {shapedNote.result.title || (isZh ? "未命名 Spark" : "Untitled Spark")}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {shapedNote.result.description || note.content}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {shapedNote.result.category && <Badge variant="secondary">{shapedNote.result.category}</Badge>}
                          {shapedNote.result.looking_for && <Badge variant="outline">{shapedNote.result.looking_for}</Badge>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                {isZh ? "还没有记录。" : "No notes yet."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => content && handleTurnIntoSpark(content)}>
            {isZh ? "把草稿变成 Spark" : "Turn draft into Spark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
