"use client"

import { useState, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Target,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Send,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { useRouter, useParams } from "next/navigation"

interface ProjectBreakdown {
  one_liner: string
  title: string
  description: string
  problem: string
  target_users: string
  mvp: string[]
  first_week: Array<{
    day: string
    goal: string
  }>
  milestones: Array<{
    name: string
    description: string
    timeframe: string
  }>
  roles: Array<{
    title: string
    skills: string[]
    description: string
  }>
  challenges: Array<{
    challenge: string
    solution: string
  }>
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id as string | null
  const router = useRouter()
  const supabase = createClient()
  const [isApplying, setIsApplying] = useState(false)
  const [selectedRole, setSelectedRole] = useState("")
  const [applicationMessage, setApplicationMessage] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  })

  // First fetch project without owner join (to avoid FK issues)
  const { data: project, isLoading, error: projectError } = useSWR(
    id ? ["project", id] : null,
    async () => {
      console.log("Fetching project with ID:", id)
      
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single()

        if (error) {
          console.error("Project fetch error:", error)
          throw error
        }
        
        console.log("Project fetched successfully:", data)
        return data
      } catch (e) {
        console.error("Exception in project fetch:", e)
        throw e
      }
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      onError: (err) => {
        console.error("SWR error:", err)
      }
    }
  )

  // Fetch owner profile separately
  const { data: ownerProfile } = useSWR(
    project?.owner_id ? ["owner", project.owner_id] : null,
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio")
        .eq("id", project!.owner_id)
        .single()
      
      if (error) {
        console.error("Owner fetch error:", error)
        return null
      }
      return data
    }
  )

  const { data: existingApplication } = useSWR(
    user && id ? ["application", id, user.id] : null,
    async () => {
      if (!user || !id) return null
      const { data } = await supabase
        .from("project_applications")
        .select("*")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .single()
      return data
    }
  )

  // Human Matching: find people whose skills overlap with required roles
  const { data: suggestedPeople } = useSWR(
    project && user ? ["suggested-people", id, user.id] : null,
    async () => {
      if (!project || !user) return []
      const breakdown = project.ai_breakdown as ProjectBreakdown | null
      // Collect all required skills from roles
      const requiredSkills: string[] = breakdown?.roles
        ? breakdown.roles.flatMap((r) => r.skills)
        : (project.required_roles || [])

      if (requiredSkills.length === 0) return []

      // Fetch profiles that have any matching skill (exclude self and owner)
      const excludeIds = [user.id, project.owner_id].filter(Boolean)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, skills")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .not("skills", "is", null)

      if (!profiles || profiles.length === 0) return []

      // Score each profile by skill overlap
      const normalizedRequired = requiredSkills.map((s) => s.toLowerCase())
      const scored = profiles
        .map((p) => {
          const userSkills: string[] = Array.isArray(p.skills) ? p.skills : []
          const matchCount = userSkills.filter((s) =>
            normalizedRequired.some(
              (r) => r.includes(s.toLowerCase()) || s.toLowerCase().includes(r)
            )
          ).length
          return { ...p, matchCount, matchedSkills: userSkills.filter((s) =>
            normalizedRequired.some(
              (r) => r.includes(s.toLowerCase()) || s.toLowerCase().includes(r)
            )
          )}
        })
        .filter((p) => p.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 3)

      return scored
    }
  )

  const { data: teamMembers } = useSWR(
    id ? ["team-members", id] : null,
    async () => {
      if (!id) return []
      const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("project_id", id)
        .single()

      if (!teams) return []

      const { data: members } = await supabase
        .from("team_members")
        .select(`
          *,
          user:profiles!team_members_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq("team_id", teams.id)
        .eq("status", "active")

      return members || []
    }
  )

  const handleApply = async () => {
    if (!user || !selectedRole || !id) return

    setIsApplying(true)
    try {
      const { error } = await supabase.from("project_applications").insert({
        project_id: id,
        user_id: user.id,
        role_applied: selectedRole,
        message: applicationMessage,
      })

      if (error) throw error

      mutate(["application", id, user.id])
      setIsDialogOpen(false)
      setSelectedRole("")
      setApplicationMessage("")
    } catch (error) {
      console.error("Error applying:", error)
    } finally {
      setIsApplying(false)
    }
  }

  // Delete project
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDelete = async () => {
    console.log("handleDelete called, id:", id, "user:", user?.id, "owner_id:", project?.owner_id)
    if (!id) {
      alert("No project ID")
      return
    }
    if (user?.id !== project.owner_id) {
      alert("You are not the owner of this project")
      return
    }
    setIsDeleting(true)
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id)
      if (error) {
        console.error("Delete error:", error)
        alert("Failed to delete: " + error.message)
        return
      }
      router.push("/explore")
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("Failed to delete project")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
          <p className="mt-2 text-muted-foreground">Getting project ID from URL</p>
          <p className="mt-2 text-xs text-muted-foreground">
            URL: {typeof window !== 'undefined' ? window.location.href : 'unknown'}
          </p>
        </main>
      </div>
    )
  }

  if (!project) {
    console.error("Project is null/undefined. isLoading:", isLoading, "error:", projectError, "id:", id)
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Project not found</h1>
          <p className="mt-2 text-muted-foreground">
            {projectError ? `Error: ${projectError.message}` : `Project ID: ${id}`}
          </p>
          {projectError && (
            <pre className="mt-4 text-left text-xs bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(projectError, null, 2)}
            </pre>
          )}
          <Button asChild className="mt-4">
            <Link href="/explore">Back to Explore</Link>
          </Button>
        </main>
      </div>
    )
  }

  const breakdown = project.ai_breakdown as ProjectBreakdown | null
  const isOwner = user?.id === project.owner_id
  
  // Combine project with owner data
  const projectWithOwner = {
    ...project,
    owner: ownerProfile
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </Link>

        {/* Project Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{project.title}</CardTitle>
                  <Badge variant={project.status === "recruiting" ? "default" : "secondary"}>
                    {project.status === "recruiting" ? "Recruiting" : project.status}
                  </Badge>
                </div>
                <CardDescription className="mt-2">{project.description}</CardDescription>
              </div>
              {breakdown && (
                <Badge variant="outline" className="flex shrink-0 items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Planned
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between border-t border-border pt-4">
              {/* Owner Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={projectWithOwner.owner?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {projectWithOwner.owner?.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{projectWithOwner.owner?.full_name || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">Project Owner</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {teamMembers?.length || 0} members
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* One Liner */}
            {breakdown?.one_liner && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-medium text-foreground">{breakdown.one_liner}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Problem & Target Users */}
            {breakdown && (breakdown.problem || breakdown.target_users) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {breakdown.problem && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">解决什么问题</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{breakdown.problem}</p>
                    </CardContent>
                  </Card>
                )}
                {breakdown.target_users && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">面向什么用户</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{breakdown.target_users}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* MVP */}
            {breakdown?.mvp && Array.isArray(breakdown.mvp) && breakdown.mvp.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    MVP（第一版包含什么）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {breakdown.mvp.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* First Week */}
            {breakdown?.first_week && Array.isArray(breakdown.first_week) && breakdown.first_week.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    第一周推进计划
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-7">
                    {breakdown.first_week.map((day, index) => (
                      <div key={index} className="rounded-lg bg-secondary/50 p-3 text-center">
                        <div className="text-xs font-medium text-primary">{day.day}</div>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-3">{day.goal}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Milestones */}
            {breakdown?.milestones && Array.isArray(breakdown.milestones) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Project Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {breakdown.milestones.map((milestone, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 rounded-lg border border-border p-4"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{milestone.name}</h4>
                            <Badge variant="outline">{milestone.timeframe}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {milestone.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Challenges */}
            {breakdown?.challenges && Array.isArray(breakdown.challenges) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Potential Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {breakdown.challenges.map((item, index) => (
                      <div key={index} className="rounded-lg bg-secondary/50 p-4">
                        <h4 className="font-medium">{item.challenge}</h4>
                        <div className="mt-2 flex items-start gap-2">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                          <p className="text-sm text-muted-foreground">{item.solution}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Required Roles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Required Roles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {breakdown?.roles && Array.isArray(breakdown.roles) ? (
                    breakdown.roles.map((role, index) => (
                      <div key={index} className="rounded-lg border border-border p-3">
                        <h4 className="font-medium">{role.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {role.skills.map((skill, skillIndex) => (
                            <Badge key={skillIndex} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    (project.required_roles || []).map((role: string, index: number) => (
                      <div key={index} className="rounded-lg border border-border p-3">
                        <h4 className="font-medium">{role}</h4>
                      </div>
                    ))
                  )}
                </div>

                {/* Apply Button */}
                {!isOwner && user && project.status === "recruiting" && (
                  <div className="mt-4">
                    {existingApplication ? (
                      <div className="rounded-lg bg-secondary p-3 text-center">
                        <p className="text-sm font-medium">Application Submitted</p>
                        <p className="text-xs text-muted-foreground">
                          Status: {existingApplication.status}
                        </p>
                      </div>
                    ) : (
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full">
                            <Send className="mr-2 h-4 w-4" />
                            Apply to Join
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Apply to {project.title}</DialogTitle>
                            <DialogDescription>
                              Select a role and tell the team why you'd be a great fit.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <label className="text-sm font-medium">Role</label>
                              <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(breakdown?.roles || (project.required_roles || []).map((r: string) => ({ title: r }))).map(
                                    (role: { title: string }, index: number) => (
                                      <SelectItem key={index} value={role.title}>
                                        {role.title}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Message (optional)</label>
                              <Textarea
                                className="mt-1"
                                placeholder="Tell the team about your experience and why you're interested..."
                                value={applicationMessage}
                                onChange={(e) => setApplicationMessage(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleApply} disabled={!selectedRole || isApplying}>
                              {isApplying ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                "Submit Application"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                {/* Delete Confirmation Dialog */}
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Project</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete "{project.title}"? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                  </div>
                )}

                {!user && (
                  <Button asChild className="mt-4 w-full">
                    <Link href={`/auth/login?redirect=/project/${id}`}>Sign in to Apply</Link>
                  </Button>
                )}

                {isOwner && (
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <Link href={`/teams`}>Manage Team</Link>
                  </Button>
                )}
                
                {/* Debug: show owner info */}
                {process.env.NODE_ENV === 'development' && user && (
                  <div className="text-xs text-gray-500 mt-2">
                    Debug: user={user.id?.slice(0,8)} owner={project.owner_id?.slice(0,8)} isOwner={isOwner ? 'yes' : 'no'}
                  </div>
                )}
                
                {/* Delete button - always show for logged in users */}
                {user && project && (
                  <Button 
                    variant="destructive" 
                    className="mt-2 w-full"
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to delete "${project.title}"?`)) {
                        return
                      }
                      if (user.id !== project.owner_id) {
                        alert("You are not the owner!")
                        return
                      }
                      try {
                        const { error } = await supabase.from("projects").delete().eq("id", id)
                        if (error) {
                          alert("Delete failed: " + error.message)
                          return
                        }
                        alert("Deleted successfully!")
                        window.location.href = "/explore"
                      } catch (err) {
                        alert("Error: " + err)
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Project
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            {teamMembers && teamMembers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {member.user?.full_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.user?.full_name || "Anonymous"}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Suggested People (Human Matching) */}
            {suggestedPeople && suggestedPeople.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Suggested People
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Based on required skills
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {suggestedPeople.map((person) => (
                      <div key={person.id} className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={person.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {person.full_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {person.full_name || "Anonymous"}
                          </p>
                          {person.bio && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {person.bio}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {person.matchedSkills.slice(0, 3).map((skill: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {skill}
                              </Badge>
                            ))}
                            {person.matchCount > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{person.matchCount - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
