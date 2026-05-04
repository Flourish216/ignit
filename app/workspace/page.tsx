"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Loader2, MessageSquare, Plus } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type TeamTarget = {
  id: string
  created_at?: string | null
}

const getTime = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

export default function WorkspaceShortcutPage() {
  const router = useRouter()
  const supabase = createClient()

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

  const { data: targetTeam, isLoading: targetLoading } = useSWR(
    user ? `workspace-shortcut-${user.id}` : null,
    async () => {
      if (!user) return null

      const [{ data: ownedProjects }, { data: memberships }] = await Promise.all([
        supabase
          .from("projects")
          .select("id, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members")
          .select(`
            team_id,
            team:teams!team_members_team_id_fkey(id, created_at)
          `)
          .eq("user_id", user.id)
          .eq("status", "accepted"),
      ])

      const ownedProjectIds = (ownedProjects || []).map((project) => project.id)
      const { data: ownedTeams } = ownedProjectIds.length
        ? await supabase
            .from("teams")
            .select("id, created_at, project_id")
            .in("project_id", ownedProjectIds)
        : { data: [] }

      const memberTeams = (memberships || [])
        .map((membership: any) => {
          const team = Array.isArray(membership.team) ? membership.team[0] : membership.team
          return team ? { id: team.id, created_at: team.created_at } : null
        })
        .filter(Boolean) as TeamTarget[]

      const allTeams = [...(ownedTeams || []), ...memberTeams]
      const uniqueTeams = Array.from(new Map(allTeams.map((team: TeamTarget) => [team.id, team])).values())

      uniqueTeams.sort((a, b) => getTime(b.created_at) - getTime(a.created_at))
      return uniqueTeams[0] || null
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

    if (targetTeam?.id) {
      router.replace(`/team/${targetTeam.id}`)
    }
  }, [router, targetTeam, user])

  if (userLoading || user === undefined || targetLoading) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!user || targetTeam?.id) return null

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <Card className="border-dashed">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-foreground">No workspace yet</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Create a Spark first. Its workspace opens automatically so you can keep building the idea.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild className="gap-2">
                <Link href="/create">
                  <Plus className="h-4 w-4" />
                  New Spark
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/teams">My Sparks</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
