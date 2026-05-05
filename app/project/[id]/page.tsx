"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import useSWR, { mutate } from "swr"
import { Archive, ArrowLeft, Calendar, CheckCircle2, Clock, Edit3, Loader2, MapPin, MessageCircle, MessageSquare, Send, UserRound, XCircle } from "lucide-react"
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
import { useLanguage } from "@/lib/i18n/context"

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
const detailFieldZh: Record<string, string> = {
  Location: "地点",
  Time: "时间",
  "Looking for": "想找谁",
  Vibe: "氛围",
}

const categoryZh: Record<string, string> = {
  Build: "做东西",
  Learn: "学习",
  Move: "运动",
  Go: "出门",
  Create: "创作",
  Other: "其他",
}

const statusZh: Record<string, string> = {
  open: "开放中",
  matched: "已开始",
  paused: "暂停",
  done: "完成",
  archived: "已归档",
}

const commonZh: Record<string, string> = {
  Flexible: "灵活",
  Online: "线上",
  Campus: "校园",
  Local: "本地",
  "Someone interested": "感兴趣的人",
  "Low-pressure": "轻松一点",
  "One-time": "一次",
  recurring: "持续",
  casual: "轻松",
  focused: "专注",
}

const getStatusLabel = (status: string, intentStatus?: string) => {
  if (intentStatus) return intentStatus
  if (status === "recruiting") return "open"
  if (status === "in_progress") return "matched"
  return status
}

const getVisibleCategory = (category: string | undefined, isZh: boolean) =>
  isZh ? categoryZh[category || "Other"] || category || "其他" : category || "Other"

const getVisibleStatus = (status: string, isZh: boolean) =>
  isZh ? statusZh[status] || status : status

const getVisibleDetailValue = (value: string | undefined, isZh: boolean) => {
  const text = value || (isZh ? "灵活" : "Flexible")
  return isZh ? commonZh[text] || text : text
}

export default function SparkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const isZh = language === "zh"
  const id = params?.id as string | null
  const supabase = createClient()
  const [message, setMessage] = useState("")
  const [isSendingInterest, setIsSendingInterest] = useState(false)
  const [isArchivingSpark, setIsArchivingSpark] = useState(false)
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
      setErrorMessage(error instanceof Error ? error.message : isZh ? "发送失败，请再试一次。" : "Could not send interest")
    } finally {
      setIsSendingInterest(false)
    }
  }

  const handleArchiveSpark = async () => {
    if (!user || !id || !isOwner) return
    if (!window.confirm(isZh ? "归档这个 Spark？它会从发现页隐藏，但仍保留在你的账号里。" : "Archive this Spark? It will disappear from Browse but stay in your account.")) return

    setIsArchivingSpark(true)
    setErrorMessage(null)

    try {
      const nextBreakdown = {
        ...((intent.ai_breakdown || {}) as IntentBreakdown),
        status: "archived",
      }

      const { error } = await supabase
        .from("projects")
        .update({
          status: "archived",
          ai_breakdown: nextBreakdown,
        })
        .eq("id", id)
        .eq("owner_id", user.id)

      if (error) throw error

      router.push("/profile")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : isZh ? "归档失败，请再试一次。" : "Could not archive Spark")
    } finally {
      setIsArchivingSpark(false)
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
      setErrorMessage(isZh ? "标题和描述都要填。" : "Title and description are required.")
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
      location: editForm.location.trim() || (isZh ? "灵活" : "Flexible"),
      time_availability: editForm.time_availability.trim() || (isZh ? "时间灵活" : "Flexible"),
      looking_for: editForm.looking_for.trim() || (isZh ? "感兴趣的人" : "Someone interested"),
      vibe: editForm.vibe.trim() || (isZh ? "轻松一点" : "Low-pressure"),
      commitment: editForm.commitment.trim() || (isZh ? "灵活" : "Flexible"),
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
      setErrorMessage(error instanceof Error ? error.message : isZh ? "保存失败，请再试一次。" : "Could not save Spark")
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
            name: `${title} 工作区`,
            created_by: user.id,
          })
          .select("id")
          .single()

        if (teamError) throw teamError
        team = newTeam
      }

      if (!team?.id) throw new Error(isZh ? "工作区打开失败。" : "Could not open workspace")

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
      setErrorMessage(error instanceof Error ? error.message : isZh ? "工作区打开失败，请再试一次。" : "Could not open workspace")
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
          <h1 className="text-2xl font-semibold">{isZh ? "找不到这个 Spark" : "Spark not found"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ? error.message : isZh ? "这个 Spark 可能已经被移除或归档。" : "This Spark may have been removed."}
          </p>
          <Button asChild className="mt-5">
            <Link href="/explore">{isZh ? "返回发现" : "Back to Browse"}</Link>
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
          {isZh ? "返回发现" : "Back to Browse"}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="space-y-5">
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{getVisibleCategory(details.category, isZh)}</Badge>
                  <Badge variant="outline" className="capitalize">{getVisibleStatus(status, isZh)}</Badge>
                  {details.commitment && <Badge variant="secondary">{getVisibleDetailValue(details.commitment, isZh)}</Badge>}
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
                      <p className="text-sm font-medium">{owner?.full_name || (isZh ? "匿名用户" : "Anonymous")}</p>
                      <p className="text-xs text-muted-foreground">{isZh ? "发布了这个 Spark" : "Posted this Spark"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(intent.created_at), { addSuffix: true, locale: isZh ? zhCN : undefined })}
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
                        {isZh ? detailFieldZh[field.label] || field.label : field.label}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {getVisibleDetailValue(details[field.key], isZh)}
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
                <CardTitle className="text-base">{isZh ? "想加入吗？" : "Want to join?"}</CardTitle>
                <CardDescription>
                  {isZh ? "发一小段说明，让对方知道你为什么感兴趣。" : "Send a short note so the other person knows why you are interested."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isOwner ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-secondary p-3 text-sm">
                      <span className="font-medium">{interestCount || 0}</span> {isZh ? "个人感兴趣" : "interested"}
                    </div>
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" variant="outline">
                          <Edit3 className="mr-2 h-4 w-4" />
                          {isZh ? "编辑 Spark" : "Edit Spark"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{isZh ? "编辑 Spark 卡片" : "Edit Spark Card"}</DialogTitle>
                          <DialogDescription>
                            {isZh ? "更新别人回应前会看到的公开卡片。" : "Update the public card people see before they respond."}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">{isZh ? "标题" : "Title"}</p>
                            <Input
                              value={editForm.title}
                              onChange={(event) => handleEditField("title", event.target.value)}
                              placeholder={isZh ? "你想做什么？" : "What do you want to do?"}
                            />
                          </div>

                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">{isZh ? "描述" : "Description"}</p>
                            <Textarea
                              value={editForm.description}
                              onChange={(event) => handleEditField("description", event.target.value)}
                              placeholder={isZh ? "描述一下这个 Spark 是什么。" : "Describe what this Spark is about."}
                              className="min-h-24"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">{isZh ? "分类" : "Category"}</p>
                              <select
                                value={editForm.category}
                                onChange={(event) => handleEditField("category", event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="">{isZh ? "其他" : "Other"}</option>
                                <option value="Build">{isZh ? "做东西" : "Build"}</option>
                                <option value="Learn">{isZh ? "学习" : "Learn"}</option>
                                <option value="Move">{isZh ? "运动" : "Move"}</option>
                                <option value="Go">{isZh ? "出门" : "Go"}</option>
                                <option value="Create">{isZh ? "创作" : "Create"}</option>
                              </select>
                            </div>

                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">{isZh ? "状态" : "Status"}</p>
                              <select
                                value={editForm.status}
                                onChange={(event) => handleEditField("status", event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="open">{isZh ? "开放中" : "open"}</option>
                                <option value="matched">{isZh ? "已开始" : "matched"}</option>
                                <option value="paused">{isZh ? "暂停" : "paused"}</option>
                                <option value="done">{isZh ? "完成" : "done"}</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">{isZh ? "地点" : "Location"}</p>
                              <Input
                                value={editForm.location}
                                onChange={(event) => handleEditField("location", event.target.value)}
                                placeholder={isZh ? "纽约、校园、线上..." : "NYC, campus, online..."}
                              />
                            </div>

                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">{isZh ? "时间" : "Time"}</p>
                              <Input
                                value={editForm.time_availability}
                                onChange={(event) => handleEditField("time_availability", event.target.value)}
                                placeholder={isZh ? "周末、晚上、这周五..." : "Weekends, evenings, this Friday..."}
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">{isZh ? "想找谁" : "Looking for"}</p>
                              <Input
                                value={editForm.looking_for}
                                onChange={(event) => handleEditField("looking_for", event.target.value)}
                                placeholder={isZh ? "健身搭子、设计师、学习搭子..." : "Gym partner, designer, study buddy..."}
                              />
                            </div>

                            <div className="grid gap-2">
                              <p className="text-sm font-medium text-foreground">{isZh ? "投入程度" : "Commitment"}</p>
                              <Input
                                value={editForm.commitment}
                                onChange={(event) => handleEditField("commitment", event.target.value)}
                                placeholder={isZh ? "一次、每周、灵活..." : "One-time, weekly, flexible..."}
                              />
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">{isZh ? "氛围" : "Vibe"}</p>
                            <Input
                              value={editForm.vibe}
                              onChange={(event) => handleEditField("vibe", event.target.value)}
                              placeholder={isZh ? "轻松、专注、试试看..." : "Chill, focused, experimental..."}
                            />
                          </div>
                        </div>

                        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{isZh ? "取消" : "Cancel"}</Button>
                          <Button onClick={handleSaveSpark} disabled={isSavingSpark}>
                            {isSavingSpark ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isZh ? "保存 Spark" : "Save Spark"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button asChild className="w-full" variant="outline">
                      <Link href="/teams?view=applications">{isZh ? "查看感兴趣的人" : "Review interests"}</Link>
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
                      {isZh ? "打开工作区" : "Open Workspace"}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleArchiveSpark}
                      disabled={isArchivingSpark}
                    >
                      {isArchivingSpark ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="mr-2 h-4 w-4" />
                      )}
                      {isZh ? "归档 Spark" : "Archive Spark"}
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
                            ? isZh ? "已匹配" : "Matched"
                            : existingInterest.status === "declined"
                              ? isZh ? "回应已关闭" : "Interest closed"
                              : isZh ? "已发送兴趣" : "Interest sent"}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {existingInterest.status === "accepted"
                          ? isZh ? "你已被接受。可以在工作区继续这个 Spark。" : "You were accepted. Continue this Spark in the workspace."
                          : existingInterest.status === "declined"
                            ? isZh ? "这次回应没有通过。" : "This response was declined."
                            : isZh ? "发起人会查看你的说明，并决定是否邀请你进入工作区。" : "The owner can review your note and accept you into the workspace."}
                      </p>
                    </div>
                    {existingInterest.status === "accepted" && matchedTeam?.id && (
                      <Button asChild className="w-full">
                        <Link href={`/team/${matchedTeam.id}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {isZh ? "打开工作区" : "Open Workspace"}
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : user ? (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <Send className="mr-2 h-4 w-4" />
                        {isZh ? "我感兴趣" : "I'm interested"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{isZh ? "发送兴趣" : "Send interest"}</DialogTitle>
                        <DialogDescription>
                          {isZh ? "简单说说为什么你想加入。" : "Keep it short. Say why this sounds fun or useful to you."}
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={isZh ? "我想加入是因为..." : "I’d be down for this because..."}
                      />
                      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{isZh ? "取消" : "Cancel"}</Button>
                        <Button onClick={handleInterest} disabled={isSendingInterest}>
                          {isSendingInterest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {isZh ? "发送" : "Send"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button asChild className="w-full">
                    <Link href={`/auth/login?redirect=/project/${id}`}>{isZh ? "登录后回应" : "Sign in to respond"}</Link>
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
