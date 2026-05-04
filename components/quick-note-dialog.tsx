"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR, { mutate } from "swr"
import { Lightbulb, Loader2, Mic, MicOff, NotebookPen, Plus, Sparkles, Trash2 } from "lucide-react"
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

type NoteSource = "text" | "voice"

type QuickNote = {
  id: string
  user_id: string
  content: string
  source: NoteSource
  converted_project_id: string | null
  created_at: string
  updated_at: string
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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const getNoteErrorMessage = (error: unknown) => {
  const errorObject = error && typeof error === "object" ? error as Record<string, unknown> : null
  const message = [
    error instanceof Error ? error.message : null,
    typeof errorObject?.message === "string" ? errorObject.message : null,
    typeof errorObject?.code === "string" ? errorObject.code : null,
    typeof errorObject?.details === "string" ? errorObject.details : null,
  ].filter(Boolean).join(" ")

  if (message.includes("public.notes") || message.includes("schema cache") || message.includes("PGRST205")) {
    return "Notes storage is not ready yet. Run scripts/create-notes-table.sql in Supabase."
  }
  return message || "Could not save note."
}

export function QuickNoteDialog({ compact = false, label = "Quick note", iconOnly = false }: QuickNoteDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef("")

  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [source, setSource] = useState<NoteSource>("text")
  const [error, setError] = useState<string | null>(null)

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
        .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)

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
      setError("Voice input is not supported in this browser.")
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
    recognition.lang = /[\u4e00-\u9fa5]/.test(navigator.language) ? "zh-CN" : navigator.language || "en-US"

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
      setError(event.error === "not-allowed" ? "Microphone permission was blocked." : "Voice input stopped.")
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
      setError(getNoteErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", noteId)
    if (error) {
      setError(error.message)
      return
    }
    mutateNotes((current = []) => current.filter((note) => note.id !== noteId), false)
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
            Quick note
          </DialogTitle>
          <DialogDescription>
            Capture a rough thought now. Turn it into a Spark when it is ready.
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
              placeholder="Record an idea, plan, place, or person you want to start with..."
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
                  {isListening ? "Stop" : "Voice"}
                </Button>
                {source === "voice" && <Badge variant="secondary">voice</Badge>}
                {!speechSupported && (
                  <span className="text-xs text-muted-foreground">Voice works in supported browsers.</span>
                )}
              </div>
              <Button type="button" onClick={handleSave} disabled={!content.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {(error || notesError) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error || getNoteErrorMessage(notesError)}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Recent notes</p>
              <Button asChild variant="ghost" size="sm">
                <Link href="/notes" onClick={() => setOpen(false)}>
                  View all
                </Link>
              </Button>
            </div>

            {notes && notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {note.content}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(note.created_at)}</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {note.source}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleTurnIntoSpark(note.content)}
                          aria-label="Turn into Spark"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(note.id)}
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                No notes yet.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => content && handleTurnIntoSpark(content)}>
            Turn draft into Spark
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
