"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

export default function TeamsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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
        .eq("status", "active")
      
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
        .eq("status", "active")
      
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
        .select("id, full_name, avatar_url, bio, skills")
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
        .update({ status: accept ? "accepted" : "rejected" })
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
              name: `${application.project?.title} Team` 
            })
            .select()
            .single()
          team = newTeam
        }

        // Add member to team
        await supabase
          .from("team_members")
          .insert({
            team_id: team?.id,
            user_id: application.user_id,
            role: application.role_applied,
            status: "active",
          })
      }

      // Refresh data
      mutate(`pending-applications-${user.id}`)
      mutate(`owned-projects-${user.id}`)
      setSelectedApplication(null)
    } catch (error) {
      console.error("Error processing application:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Show loading while checking auth (user is undefined = not yet loaded)
  if (userLoading || user === undefined) {
    return (
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Teams</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your projects and team collaborations
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
                    {pendingApplications.length} pending application{pendingApplications.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    People want to join your projects
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="#applications">Review</a>
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="owned" className="space-y-6">
          <TabsList>
            <TabsTrigger value="owned" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              My Projects
              {myProjects && myProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myProjects.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="member" className="gap-2">
              <Users className="h-4 w-4" />
              Joined Teams
              {myMemberships && myMemberships.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myMemberships.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2" id="applications">
              <Mail className="h-4 w-4" />
              Applications
              {pendingApplications && pendingApplications.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {pendingApplications.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My Projects Tab */}
          <TabsContent value="owned">
            {myProjects && myProjects.length > 0 ? (
              <div className="space-y-6">
                {myProjects.map((project) => (
                  <Card key={project.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{project.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {project.description?.slice(0, 100)}
                            {project.description && project.description.length > 100 && "..."}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={project.status === "recruiting" ? "default" : "secondary"}>
                            {project.status}
                          </Badge>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/project/${project.id}`}>
                              View
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="mb-2 text-sm font-medium text-muted-foreground">Team Members</p>
                          <div className="flex items-center gap-2">
                            {project.teams?.[0]?.team_members?.length > 0 ? (
                              <>
                                <div className="flex -space-x-2">
                                  {project.teams[0].team_members.slice(0, 5).map((member: any) => (
                                    <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                                      <AvatarImage src={member.user?.avatar_url || ""} />
                                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                        {member.user?.full_name?.[0]?.toUpperCase() || "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {project.teams[0].team_members.length} member{project.teams[0].team_members.length > 1 ? "s" : ""}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">No team members yet</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Looking for:</p>
                          <div className="mt-1 flex flex-wrap justify-end gap-1">
                            {project.required_roles.slice(0, 3).map((role: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold text-foreground">No projects yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first project and start building a team
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/create">Create Project</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Joined Teams Tab */}
          <TabsContent value="member">
            {myMemberships && myMemberships.length > 0 ? (
              <div className="space-y-4">
                {myMemberships.map((membership) => (
                  <Card key={membership.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={membership.team?.project?.owner?.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {membership.team?.project?.owner?.full_name?.[0]?.toUpperCase() || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              href={`/project/${membership.team?.project?.id}`}
                              className="font-semibold text-foreground hover:text-primary"
                            >
                              {membership.team?.project?.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              Your role: <span className="font-medium">{membership.role}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{membership.team?.project?.status}</Badge>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/project/${membership.team?.project?.id}`}>
                              View Project
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold text-foreground">Not in any teams yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Find projects that match your skills and apply to join
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/explore">Explore Projects</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            {pendingApplications && pendingApplications.length > 0 ? (
              <div className="space-y-4">
                {pendingApplications.map((application) => (
                  <Card key={application.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={application.user?.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {application.user?.full_name?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">
                              {application.user?.full_name || "Anonymous"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Applied for <span className="font-medium">{application.role_applied}</span>
                              {" "}in <span className="font-medium">{application.project?.title}</span>
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
                            </div>
                            {application.user?.skills && application.user.skills.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {application.user.skills.slice(0, 4).map((skill: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedApplication(application)}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplicationResponse(application.id, false)}
                            disabled={isProcessing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApplicationResponse(application.id, true)}
                            disabled={isProcessing}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold text-foreground">No pending applications</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When people apply to your projects, they'll appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Application Detail Dialog */}
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>
                Review this application for {selectedApplication?.project?.title}
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedApplication.user?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-xl text-primary">
                      {selectedApplication.user?.full_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold">
                      {selectedApplication.user?.full_name || "Anonymous"}
                    </p>
                    <Badge>{selectedApplication.role_applied}</Badge>
                  </div>
                </div>

                {selectedApplication.user?.bio && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bio</p>
                    <p className="mt-1 text-foreground">{selectedApplication.user.bio}</p>
                  </div>
                )}

                {selectedApplication.message && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Message</p>
                    <p className="mt-1 text-foreground">{selectedApplication.message}</p>
                  </div>
                )}

                {selectedApplication.user?.skills && selectedApplication.user.skills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Skills</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedApplication.user.skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
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
