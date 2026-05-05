"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Users,
  FolderOpen,
  Mail,
  Check,
  X,
  Loader2,
  ArrowRight,
  UserPlus,
  Clock,
  ExternalLink,
  MapPin,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

const goalsPrefix = "profile:goals:"
const availabilityPrefix = "profile:availability:"

function readStoredValue(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return ""
  const item = value.find((entry) => typeof entry === "string" && entry.startsWith(prefix))
  return typeof item === "string" ? item.slice(prefix.length) : ""
}

function getProfileGoals(profile: any) {
  return profile?.current_goals || readStoredValue(profile?.interests, goalsPrefix)
}

function getProfileAvailability(profile: any) {
  return profile?.availability || readStoredValue(profile?.skills, availabilityPrefix)
}

function getVisibleProfileTags(profile: any) {
  const skills = Array.isArray(profile?.skills)
    ? profile.skills.filter((item: string) => !item.startsWith(availabilityPrefix))
    : []
  const interests = Array.isArray(profile?.interests)
    ? profile.interests.filter((item: string) => !item.startsWith(goalsPrefix))
    : []

  return [...skills, ...interests]
}

export default function TeamsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<"owned" | "member" | "applications">("owned")

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view")
    if (view === "applications") {
      setActiveView("applications")
    }
  }, [])

  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  }, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  // Projects I own
  const { data: myProjectsRaw } = useSWR(
    user ? `owned-projects-${user.id}` : null,
    async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("owner_id", user.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
      
      if (error) {
        console.error("My projects fetch error:", error)
        return []
      }
      return data || []
    }
  )

  // Fetch teams for my projects
  const { data: projectTeams } = useSWR(
    myProjectsRaw ? `project-teams-${user?.id}` : null,
    async () => {
      if (!myProjectsRaw || myProjectsRaw.length === 0) return {}
      
      const projectIds = myProjectsRaw.map(p => p.id)
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, project_id")
        .in("project_id", projectIds)
      
      if (error) {
        console.error("Teams fetch error:", error)
        return {}
      }
      
      const teamMap: Record<string, any> = {}
      data?.forEach((team: any) => {
        teamMap[team.project_id] = team
      })
      return teamMap
    }
  )

  // Fetch team members
  const { data: teamMembersData } = useSWR(
    projectTeams ? `team-members-${user?.id}` : null,
    async () => {
      const teamIds = Object.values(projectTeams || {}).map((t: any) => t.id)
      if (teamIds.length === 0) return {}
      
      const { data, error } = await supabase
        .from("team_members")
        .select("id, team_id, role, status, user_id")
        .in("team_id", teamIds)
        .eq("status", "accepted")
      
      if (error) {
        console.error("Team members fetch error:", error)
        return {}
      }
      
      // Group by team_id
      const membersMap: Record<string, any[]> = {}
      data?.forEach((member: any) => {
        if (!membersMap[member.team_id]) {
          membersMap[member.team_id] = []
        }
        membersMap[member.team_id].push(member)
      })
      return membersMap
    }
  )

  // Fetch member profiles
  const { data: memberProfiles } = useSWR(
    teamMembersData ? `member-profiles-${user?.id}` : null,
    async () => {
      const allMembers = Object.values(teamMembersData || {}).flat()
      const userIds = [...new Set(allMembers.map((m: any) => m.user_id))]
      if (userIds.length === 0) return {}
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds)
      
      if (error) {
        console.error("Member profiles fetch error:", error)
        return {}
      }
      
      const profileMap: Record<string, any> = {}
      data?.forEach((profile: any) => {
        profileMap[profile.id] = profile
      })
      return profileMap
    }
  )

  // Combine all data
  const myProjects = myProjectsRaw?.map(project => {
    const team = projectTeams?.[project.id]
    const members = team ? teamMembersData?.[team.id] || [] : []
    const membersWithProfiles = members.map((m: any) => ({
      ...m,
      user: memberProfiles?.[m.user_id] || null
    }))
    
    return {
      ...project,
      teams: team ? [{
        ...team,
        team_members: membersWithProfiles
      }] : []
    }
  })

  // Teams I'm a member of
  const { data: myMembershipsRaw } = useSWR(
    user ? `my-memberships-${user.id}` : null,
    async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          *,
          team:teams!team_members_team_id_fkey(
            id,
            name,
            project_id
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "accepted")
      
      if (error) {
        console.error("Memberships fetch error:", error)
        return []
      }
      return data || []
    }
  )

  // Fetch projects for memberships
  const { data: membershipProjects } = useSWR(
    myMembershipsRaw ? `membership-projects-${user?.id}` : null,
    async () => {
      if (!myMembershipsRaw || myMembershipsRaw.length === 0) return {}
      
      const projectIds = [...new Set(myMembershipsRaw.map((m: any) => m.team?.project_id).filter(Boolean))]
      if (projectIds.length === 0) return {}
      
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, owner_id")
        .in("id", projectIds)
        .neq("status", "archived")
      
      if (error) {
        console.error("Membership projects fetch error:", error)
        return {}
      }
      
      const projectMap: Record<string, any> = {}
      data?.forEach((p: any) => {
        projectMap[p.id] = p
      })
      return projectMap
    }
  )

  // Fetch project owners
  const { data: projectOwners } = useSWR(
    membershipProjects ? `project-owners-${user?.id}` : null,
    async () => {
      const ownerIds = [...new Set(Object.values(membershipProjects || {}).map((p: any) => p.owner_id).filter(Boolean))]
      if (ownerIds.length === 0) return {}
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ownerIds)
      
      if (error) {
        console.error("Project owners fetch error:", error)
        return {}
      }
      
      const ownerMap: Record<string, any> = {}
      data?.forEach((o: any) => {
        ownerMap[o.id] = o
      })
      return ownerMap
    }
  )

  // Combine membership data
  const myMemberships = myMembershipsRaw?.map((membership: any) => {
    const project = membership.team?.project_id ? membershipProjects?.[membership.team.project_id] : null
    const owner = project?.owner_id ? projectOwners?.[project.owner_id] : null
    
    return {
      ...membership,
      team: membership.team ? {
        ...membership.team,
        project: project ? {
          ...project,
          owner
        } : null
      } : null
    }
  })

  // Pending applications for my projects
  const { data: pendingApplicationsRaw } = useSWR(
    user ? `pending-applications-${user.id}` : null,
    async () => {
      if (!user) return []
      
      // First get all project IDs owned by this user
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("owner_id", user.id)
        .neq("status", "archived")

      if (!projects || projects.length === 0) return []

      const projectIds = projects.map(p => p.id)

      const { data, error } = await supabase
        .from("project_applications")
        .select("*")
        .in("project_id", projectIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Pending applications fetch error:", error)
        return []
      }

      return data || []
    }
  )

  // Fetch applicant profiles
  const { data: applicantProfiles } = useSWR(
    pendingApplicationsRaw ? `applicant-profiles-${user?.id}` : null,
    async () => {
      if (!pendingApplicationsRaw || pendingApplicationsRaw.length === 0) return {}
      
      const userIds = [...new Set(pendingApplicationsRaw.map((a: any) => a.user_id))]
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, skills, interests, location, website")
        .in("id", userIds)
      
      if (error) {
        console.error("Applicant profiles fetch error:", error)
        return {}
      }
      
      const profileMap: Record<string, any> = {}
      data?.forEach((p: any) => {
        profileMap[p.id] = p
      })
      return profileMap
    }
  )

  // Fetch project titles for applications
  const { data: applicationProjects } = useSWR(
    pendingApplicationsRaw ? `application-projects-${user?.id}` : null,
    async () => {
      if (!pendingApplicationsRaw || pendingApplicationsRaw.length === 0) return {}
      
      const projectIds = [...new Set(pendingApplicationsRaw.map((a: any) => a.project_id))]
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .in("id", projectIds)
      
      if (error) {
        console.error("Application projects fetch error:", error)
        return {}
      }
      
      const projectMap: Record<string, any> = {}
      data?.forEach((p: any) => {
        projectMap[p.id] = p
      })
      return projectMap
    }
  )

  // Combine application data
  const pendingApplications = pendingApplicationsRaw?.map((app: any) => ({
    ...app,
    user: applicantProfiles?.[app.user_id] || null,
    project: applicationProjects?.[app.project_id] || null
  }))

  const handleApplicationResponse = async (applicationId: string, accept: boolean) => {
    if (!user) return

    setIsProcessing(true)
    try {
      const application = pendingApplications?.find(a => a.id === applicationId)
      if (!application) return

      // Update application status
      await supabase
        .from("project_applications")
        .update({ status: accept ? "accepted" : "declined" })
        .eq("id", applicationId)

      if (accept) {
        // Get or create team for project
        let { data: team } = await supabase
          .from("teams")
          .select("id")
          .eq("project_id", application.project_id)
          .single()

        if (!team) {
          const { data: newTeam } = await supabase
            .from("teams")
            .insert({ 
              project_id: application.project_id, 
              name: `${application.project?.title} Team`,
              created_by: user.id,
            })
            .select()
            .single()
          team = newTeam
        }

        if (team?.id) {
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

        }

        // Add member to team
        await supabase
          .from("team_members")
          .upsert(
            {
            team_id: team?.id,
            user_id: application.user_id,
            role: application.role_applied,
            status: "accepted",
            },
            { onConflict: "team_id,user_id" },
          )

        await supabase
          .from("projects")
          .update({ status: "in_progress" })
          .eq("id", application.project_id)
          .eq("status", "recruiting")

        if (team?.id) {
          await supabase.from("messages").insert({
            project_id: application.project_id,
            user_id: user.id,
            content: `Match started: ${application.user?.full_name || "Someone"} joined this Spark. Say hi and decide the first tiny step.`,
          })
        }
      }

      // Refresh data
      mutate(`pending-applications-${user.id}`)
      mutate(`owned-projects-${user.id}`)
      mutate(`project-teams-${user.id}`)
      setSelectedApplication(null)
    } catch (error) {
      console.error("Error processing application:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenWorkspace = async (project: any) => {
    if (!user) return

    const existingTeamId = project.teams?.[0]?.id
    if (existingTeamId) {
      router.push(`/team/${existingTeamId}`)
      return
    }

    setOpeningWorkspaceId(project.id)
    try {
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("id")
        .eq("project_id", project.id)
        .maybeSingle()

      let team = existingTeam

      if (!team) {
        const { data: newTeam, error: teamError } = await supabase
          .from("teams")
          .insert({
            project_id: project.id,
            name: `${project.title} Workspace`,
            created_by: user.id,
          })
          .select("id")
          .single()

        if (teamError) throw teamError
        team = newTeam
      }

      if (!team?.id) throw new Error("Could not open workspace")

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

      mutate(`project-teams-${user.id}`)
      router.push(`/team/${team.id}`)
    } catch (error) {
      console.error("Error opening workspace:", error)
    } finally {
      setOpeningWorkspaceId(null)
    }
  }

  // Show loading while checking auth (user is undefined = not yet loaded)
  if (userLoading || user === undefined) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // Only redirect when auth check is complete and user is confirmed null
  if (user === null) {
    router.push("/auth/login?redirect=/teams")
    return null
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Sparks</h1>
          <p className="mt-1 text-muted-foreground">
            Review interest, see what you posted, and open workspaces when a Spark becomes a Match.
          </p>
        </div>

        {/* Pending Applications Alert */}
        {pendingApplications && pendingApplications.length > 0 && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {pendingApplications.length} new interest{pendingApplications.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    People responded to your Sparks.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveView("applications")}>
                Review
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-border bg-card p-2 lg:sticky lg:top-24 lg:self-start">
            {[
              { id: "owned", label: "Posted Sparks", detail: "Things you started", icon: FolderOpen, count: myProjects?.length || 0 },
              { id: "member", label: "Matches", detail: "Accepted Sparks", icon: Users, count: myMemberships?.length || 0 },
              { id: "applications", label: "Interest", detail: "People who responded", icon: Mail, count: pendingApplications?.length || 0 },
            ].map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as typeof activeView)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className={`block truncate text-xs ${isActive ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                      {item.detail}
                    </span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-primary-foreground/15" : "bg-secondary text-muted-foreground"}`}>
                    {item.count}
                  </span>
                </button>
              )
            })}
          </aside>

          <section className="min-w-0">
            {activeView === "owned" && (
              myProjects && myProjects.length > 0 ? (
                <div className="space-y-4">
                  {myProjects.map((project) => (
                    <div key={project.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-semibold text-foreground">{project.title}</h2>
                            <Badge variant={project.status === "recruiting" ? "default" : "secondary"}>{project.status}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleOpenWorkspace(project)}
                            disabled={openingWorkspaceId === project.id}
                          >
                            {openingWorkspaceId === project.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Open Workspace
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/project/${project.id}`}>
                              View
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-md bg-secondary/50 p-3">
                          <p className="text-xs text-muted-foreground">People</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                          {project.teams?.[0]?.team_members?.length || 0} people
                          </p>
                        </div>
                        <div className="rounded-md bg-secondary/50 p-3 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">Next step</p>
                          <p className="mt-1 text-sm text-foreground">
                            {project.teams?.[0]?.team_members?.length > 0
                              ? "Open the workspace and decide the first concrete step."
                              : "Open the workspace, ask Igni, and keep shaping the idea while you find people."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-10 text-center">
                  <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold text-foreground">No Sparks yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Post something you want to do with someone else.</p>
                  <Button asChild className="mt-4"><Link href="/create">New Spark</Link></Button>
                </div>
              )
            )}

            {activeView === "member" && (
              myMemberships && myMemberships.length > 0 ? (
                <div className="space-y-3">
                  {myMemberships.map((membership) => (
                    <div key={membership.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={membership.team?.project?.owner?.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {membership.team?.project?.owner?.full_name?.[0]?.toUpperCase() || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link href={`/project/${membership.team?.project?.id}`} className="font-semibold text-foreground hover:text-primary">
                              {membership.team?.project?.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">{membership.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{membership.team?.project?.status}</Badge>
                          {membership.team?.id && (
                            <Button asChild size="sm"><Link href={`/team/${membership.team.id}`}>Open Workspace</Link></Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-10 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold text-foreground">Nothing started yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Browse Sparks and say you are interested.</p>
                  <Button asChild className="mt-4"><Link href="/explore">Browse Sparks</Link></Button>
                </div>
              )
            )}

            {activeView === "applications" && (
              pendingApplications && pendingApplications.length > 0 ? (
                <div className="space-y-3">
                  {pendingApplications.map((application) => (
                    <div key={application.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={application.user?.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {application.user?.full_name?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">{application.user?.full_name || "Anonymous"}</p>
                            <p className="text-sm text-muted-foreground">
                              Is interested in <span className="font-medium">{application.project?.title}</span>
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedApplication(application)}>View</Button>
                          <Button size="sm" variant="outline" onClick={() => handleApplicationResponse(application.id, false)} disabled={isProcessing}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => handleApplicationResponse(application.id, true)} disabled={isProcessing}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-10 text-center">
                  <Mail className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold text-foreground">No new interest</h3>
                  <p className="mt-1 text-sm text-muted-foreground">When people respond to your Sparks, they will appear here.</p>
                </div>
              )
            )}
          </section>
        </div>

        {/* Application Detail Dialog */}
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Interest profile</DialogTitle>
              <DialogDescription>
                Review the person who responded to {selectedApplication?.project?.title}
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-5 py-4">
                <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedApplication.user?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-xl text-primary">
                      {selectedApplication.user?.full_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">
                      {selectedApplication.user?.full_name || "Anonymous"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Interested in <span className="font-medium text-foreground">{selectedApplication.project?.title}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{selectedApplication.role_applied}</Badge>
                      {selectedApplication.user?.location && (
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="h-3 w-3" />
                          {selectedApplication.user.location}
                        </Badge>
                      )}
                      {getProfileAvailability(selectedApplication.user) && (
                        <Badge variant="outline">{getProfileAvailability(selectedApplication.user)}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-muted-foreground">About</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {selectedApplication.user?.bio || "No profile description yet."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-muted-foreground">Wants to start</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {getProfileGoals(selectedApplication.user) || "No start intent added yet."}
                    </p>
                  </div>
                </div>

                {selectedApplication.message && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium text-muted-foreground">Message</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{selectedApplication.message}</p>
                  </div>
                )}

                {getVisibleProfileTags(selectedApplication.user).length > 0 && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-muted-foreground">Profile notes</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {getVisibleProfileTags(selectedApplication.user).map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedApplication.user?.website && (
                  <Button asChild variant="outline" className="w-full justify-center gap-2">
                    <a href={selectedApplication.user.website} target="_blank" rel="noreferrer">
                      Open website
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleApplicationResponse(selectedApplication?.id, false)}
                disabled={isProcessing}
              >
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button
                onClick={() => handleApplicationResponse(selectedApplication?.id, true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Accept
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
