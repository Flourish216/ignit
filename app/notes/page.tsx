"use client"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { Loader2, Mic, NotebookPen, Sparkles, Trash2, Type } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { QuickNoteDialog } from "@/components/quick-note-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type Note = {
  id: string
  user_id: string
  content: string
  source: "text" | "voice"
  converted_project_id: string | null
  created_at: string
  updated_at: string
}

const getNoteErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "")
  if (message.includes("public.notes") || message.includes("schema cache")) {
    return "Notes storage is not ready yet. Run scripts/create-notes-table.sql in Supabase."
  }
  return message || "Could not load notes."
}

export default function NotesPage() {
  const router = useRouter()
  const supabase = createClient()

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
        .select("id, user_id, content, source, converted_project_id, created_at, updated_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as Note[]
    },
    { shouldRetryOnError: false },
  )

  const handleDelete = async (noteId: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", noteId)
    if (error) return
    mutate((current = []) => current.filter((note) => note.id !== noteId), false)
  }

  const handleTurnIntoSpark = (content: string) => {
    router.push(`/create?idea=${encodeURIComponent(content)}`)
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
              Idea inbox
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Notes</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Keep rough thoughts here before they become Sparks.
            </p>
          </div>
          <QuickNoteDialog label="New note" />
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-6">
              <p className="text-sm text-destructive">{getNoteErrorMessage(error)}</p>
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
                            {note.source}
                          </Badge>
                          <span>
                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                          {note.content}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleTurnIntoSpark(note.content)}
                        >
                          <Sparkles className="h-4 w-4" />
                          Spark
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(note.id)}
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
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
              <h2 className="mt-4 text-lg font-semibold text-foreground">No notes yet</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Capture a sentence, voice thought, or half-formed idea. You can turn it into a Spark later.
              </p>
              <div className="mt-5">
                <QuickNoteDialog label="Capture first note" />
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
