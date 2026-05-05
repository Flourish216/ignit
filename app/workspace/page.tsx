"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { ArrowRight, Loader2, MessageSquare, Plus, Sparkles, Users } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/i18n/context"

type TeamTarget = {
  id: string
  name: string | null
  project_id: string
  created_at?: string | null
  project?: {
    id: string
    title: string | null
    description: string | null
    status: string | null
    ai_breakdown: {
      title?: string
      description?: string
      category?: string
      looking_for?: string
    } | null
  } | null
  member_count?: number
  latest_message_at?: string | null
}

const getTime = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

const firstRelation = <T,>(relation: T | T[] | null | undefined) =>
  Array.isArray(relation) ? relation[0] || null : relation || null

const getWorkspaceActivityTime = (team: TeamTarget) =>
  Math.max(getTime(team.latest_message_at), getTime(team.created_at))

const categoryZh: Record<string, string> = {
  Build: "做东西",
  Learn: "学习",
  Move: "运动",
  Go: "出门",
  Create: "创作",
  Spark: "Spark",
}

const statusZh: Record<string, string> = {
  open: "开放中",
  matched: "已开始",
  recruiting: "开放中",
  in_progress: "已开始",
  completed: "完成",
}

const commonZh: Record<string, string> = {
  Flexible: "灵活",
  Online: "线上",
  Campus: "校园",
  Local: "本地",
  "Someone interested": "感兴趣的人",
}

const getVisibleCategory = (category: string | undefined, isZh: boolean) =>
  isZh ? categoryZh[category || "Spark"] || category || "Spark" : category || "Spark"

const getVisibleStatus = (status: string | undefined, isZh: boolean) =>
  isZh ? statusZh[status || "open"] || status || "开放中" : status || "open"

const getVisibleText = (value: string | undefined, isZh: boolean) =>
  isZh ? commonZh[value || ""] || value : value

export default function WorkspaceShortcutPage() {
  const router = useRouter()
  const supabase = createClient()
  const { language } = useLanguage()
  const isZh = language === "zh"

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

  const { data: workspaces, isLoading: workspacesLoading } = useSWR(
    user ? `workspace-list-${user.id}` : null,
    async () => {
      if (!user) return []

      const [{ data: ownedProjects }, { data: memberships }] = await Promise.all([
        supabase
          .from("projects")
          .select("id")
          .eq("owner_id", user.id)
          .neq("status", "archived")
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members")
          .select(`
            team_id,
            team:teams!team_members_team_id_fkey(id)
          `)
          .eq("user_id", user.id)
          .eq("status", "accepted"),
      ])

      const ownedProjectIds = (ownedProjects || []).map((project) => project.id)
      const memberTeamIds = (memberships || [])
        .map((membership: any) => firstRelation(membership.team)?.id || membership.team_id)
        .filter(Boolean)

      const { data: ownedTeams } = ownedProjectIds.length
        ? await supabase
            .from("teams")
            .select(`
              id,
              name,
              project_id,
              created_at,
              project:projects(id, title, description, status, ai_breakdown)
            `)
            .in("project_id", ownedProjectIds)
        : { data: [] }

      const { data: memberTeams } = memberTeamIds.length
        ? await supabase
            .from("teams")
            .select(`
              id,
              name,
              project_id,
              created_at,
              project:projects(id, title, description, status, ai_breakdown)
            `)
            .in("id", memberTeamIds)
        : { data: [] }

      const allTeams = [...(ownedTeams || []), ...memberTeams]
      const uniqueTeams = Array.from(new Map(allTeams.map((team: any) => [team.id, team])).values()) as any[]
      const teamIds = uniqueTeams.map((team) => team.id)
      const projectIds = uniqueTeams.map((team) => team.project_id).filter(Boolean)

      const [{ data: memberCounts }, { data: latestMessages }] = await Promise.all([
        teamIds.length
          ? supabase
              .from("team_members")
              .select("team_id")
              .in("team_id", teamIds)
              .eq("status", "accepted")
          : Promise.resolve({ data: [] }),
        projectIds.length
          ? supabase
              .from("messages")
              .select("project_id, created_at")
              .in("project_id", projectIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ])

      const memberCountByTeam = (memberCounts || []).reduce((counts: Record<string, number>, member: any) => {
        counts[member.team_id] = (counts[member.team_id] || 0) + 1
        return counts
      }, {})

      const latestMessageByProject = (latestMessages || []).reduce((latest: Record<string, string>, message: any) => {
        if (!latest[message.project_id]) latest[message.project_id] = message.created_at
        return latest
      }, {})

      const normalizedTeams = uniqueTeams
        .map((team) => ({
          ...team,
          project: firstRelation(team.project),
          member_count: memberCountByTeam[team.id] || 0,
          latest_message_at: latestMessageByProject[team.project_id] || null,
        }))
        .filter((team) => team.project?.status !== "archived") as TeamTarget[]

      normalizedTeams.sort((a, b) => getWorkspaceActivityTime(b) - getWorkspaceActivityTime(a))
      return normalizedTeams
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  )

  useEffect(() => {
    if (user === null) {
      router.replace("/auth/login?redirect=/workspace")
      return
    }

    if (workspaces?.length === 1) {
      router.replace(`/team/${workspaces[0].id}`)
    }
  }, [router, workspaces, user])

  if (userLoading || user === undefined || workspacesLoading) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!user || workspaces?.length === 1) return null

  const hasWorkspaces = Boolean(workspaces && workspaces.length > 0)

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {!hasWorkspaces ? (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-foreground">{isZh ? "还没有工作区" : "No workspace yet"}</h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {isZh ? "先创建一个 Spark。工作区会自动打开，方便你继续推进想法。" : "Create a Spark first. Its workspace opens automatically so you can keep building the idea."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button asChild className="gap-2">
                  <Link href="/create">
                    <Plus className="h-4 w-4" />
                    {isZh ? "新建 Spark" : "New Spark"}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/teams">{isZh ? "我的 Spark" : "My Sparks"}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
                  <MessageSquare className="h-4 w-4" />
                  {isZh ? "工作区" : "Workspace"}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {isZh ? "选择一个工作区" : "Choose a workspace"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {isZh ? "你有多个正在进行的 Spark。选择一个你想继续的房间。" : "You have more than one active Spark. Pick the room you want to continue."}
                </p>
              </div>
              <Button asChild className="w-full gap-2 sm:w-auto">
                <Link href="/create">
                  <Plus className="h-4 w-4" />
                  {isZh ? "新建 Spark" : "New Spark"}
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {workspaces?.map((team) => {
                const details = team.project?.ai_breakdown || {}
                const title = details.title || team.project?.title || team.name || (isZh ? "未命名工作区" : "Untitled workspace")
                const description = details.description || team.project?.description || (isZh ? "还没有 Spark 简介。" : "No Spark brief yet.")
                const activityLabel = team.latest_message_at ? isZh ? "最近聊天" : "recent chat" : isZh ? "创建于" : "created"
                const status = details.status || team.project?.status || "open"

                return (
                  <Card key={team.id} className="overflow-hidden transition-colors hover:border-primary/40">
                    <CardContent className="flex h-full flex-col p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              {getVisibleCategory(details.category, isZh)}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {getVisibleStatus(status, isZh)}
                            </Badge>
                          </div>
                          <h2 className="line-clamp-2 text-lg font-semibold text-foreground">{title}</h2>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{description}</p>

                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2 rounded-md bg-secondary/60 px-2.5 py-2">
                          <Users className="h-3.5 w-3.5" />
                          <span>{team.member_count || 0} {isZh ? "人" : "people"}</span>
                        </div>
                        <div className="rounded-md bg-secondary/60 px-2.5 py-2">
                          {activityLabel}:{" "}
                          {new Date(team.latest_message_at || team.created_at || Date.now()).toLocaleDateString(isZh ? "zh-CN" : undefined)}
                        </div>
                      </div>

                      {details.looking_for && (
                        <div className="mt-3 rounded-md bg-primary/5 px-2.5 py-2 text-xs text-foreground">
                          {isZh ? "想找：" : "Looking for: "}{getVisibleText(details.looking_for, isZh)}
                        </div>
                      )}

                      <Button asChild className="mt-5 w-full gap-2">
                        <Link href={`/team/${team.id}`}>
                          {isZh ? "打开工作区" : "Open workspace"}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
