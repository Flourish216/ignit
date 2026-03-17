"use client"

import { use, useState } from "react"
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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

interface ProjectBreakdown {
  title: string
  description: string
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

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
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

  const { data: project, isLoading } = useSWR(
    ["project", id],
    async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url, bio)
        `)
        .eq("id", id)
        .single()

      if (error) throw error
      return data
    }
  )

  const { data: existingApplication } = useSWR(
    user ? ["application", id, user.id] : null,
    async () => {
      if (!user) return null
      const { data } = await supabase
        .from("project_applications")
        .select("*")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .single()
      return data
    }
  )

  const { data: teamMembers } = useSWR(
    ["team-members", id],
    async () => {
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
    if (!user || !selectedRole) return

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

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Project not found</h1>
          <Button asChild className="mt-4">
            <Link href="/explore">Back to Explore</Link>
          </Button>
        </main>
      </div>
    )
  }

  const breakdown = project.ai_breakdown as ProjectBreakdown | null
  const isOwner = user?.id === project.owner_id

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
                  <AvatarImage src={project.owner?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {project.owner?.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{project.owner?.full_name || "Anonymous"}</p>
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
            {/* Milestones */}
            {breakdown?.milestones && (
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
            {breakdown?.challenges && (
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
                  {breakdown?.roles ? (
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
                    project.required_roles.map((role: string, index: number) => (
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
                                  {(breakdown?.roles || project.required_roles.map((r: string) => ({ title: r }))).map(
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
          </div>
        </div>
      </main>
    </div>
  )
}
