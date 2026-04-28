"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  User,
  MapPin,
  Link as LinkIcon,
  Edit2,
  Save,
  X,
  Plus,
  Loader2,
  FolderOpen,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { ProjectCard } from "@/components/project-card"

const availableSkills = [
  // 创意与内容
  "Writing", "Storytelling", "Video Production", "Photography", "Illustration",
  "Graphic Design", "Branding", "Music", "Podcast",
  // 商业与运营
  "Marketing", "Growth", "Sales", "Business Strategy", "Finance",
  "Operations", "Community Building", "Fundraising", "Partnership",
  // 产品与设计
  "Product Management", "UI/UX Design", "Research", "Project Management",
  "Customer Success",
  // 技术
  "Frontend Development", "Backend Development", "Mobile Development",
  "AI/ML", "Data Analysis", "No-code / Low-code",
  // 其他专业领域
  "Education", "Healthcare", "Legal", "Social Impact", "Sustainability",
  "Hardware / Physical Products",
]

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: "",
    bio: "",
    location: "",
    website: "",
    skills: [] as string[],
    interests: [] as string[],
    current_goals: "",
    availability: "",
  })

  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  })

  const { data: profile, isLoading: profileLoading } = useSWR(
    user ? `profile-${user.id}` : null,
    async () => {
      if (!user) return null
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      return data
    }
  )

  const { data: myProjectsRaw } = useSWR(
    user ? `my-projects-${user.id}` : null,
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

  // Add current user as owner to projects
  const myProjects = myProjectsRaw?.map(project => ({
    ...project,
    owner: profile ? {
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url
    } : null
  }))

  const { data: joinedTeamsRaw } = useSWR(
    user ? `joined-teams-${user.id}` : null,
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
        console.error("Joined teams fetch error:", error)
        return []
      }
      return data || []
    }
  )

  // Fetch projects for joined teams separately
  const { data: joinedProjects } = useSWR(
    joinedTeamsRaw ? `joined-projects-${user.id}` : null,
    async () => {
      if (!joinedTeamsRaw || joinedTeamsRaw.length === 0) return {}
      
      const projectIds = [...new Set(joinedTeamsRaw.map((m: any) => m.team?.project_id).filter(Boolean))]
      if (projectIds.length === 0) return {}
      
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, owner_id")
        .in("id", projectIds)
      
      if (error) {
        console.error("Joined projects fetch error:", error)
        return {}
      }
      
      const projectMap: Record<string, any> = {}
      data?.forEach((p: any) => {
        projectMap[p.id] = p
      })
      return projectMap
    }
  )

  // Combine team membership with project data
  const joinedTeams = joinedTeamsRaw?.map((membership: any) => ({
    ...membership,
    team: membership.team ? {
      ...membership.team,
      project: joinedProjects?.[membership.team.project_id] || null
    } : null
  }))

  const startEditing = () => {
    setEditForm({
      full_name: profile?.full_name || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      website: profile?.website || "",
      skills: profile?.skills || [],
      interests: profile?.interests || [],
      current_goals: profile?.current_goals || "",
      availability: profile?.availability || "",
    })
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditForm({
      full_name: "",
      bio: "",
      location: "",
      website: "",
      skills: [],
      interests: [],
      current_goals: "",
      availability: "",
    })
  }

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name,
          bio: editForm.bio,
          location: editForm.location,
          website: editForm.website,
          skills: editForm.skills,
          interests: editForm.interests,
          current_goals: editForm.current_goals,
          availability: editForm.availability,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error

      mutate(`profile-${user.id}`)
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSkill = (skill: string) => {
    setEditForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  if (userLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!user) {
    router.push("/auth/login?redirect=/profile")
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Builder Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Show what you can do, what you want to build, and when you are available.
          </p>
        </div>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                  {profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        placeholder="Your name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Bio</label>
                      <Textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        placeholder="Tell others about yourself..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">What are you looking for?</label>
                      <Input
                        value={editForm.current_goals}
                        onChange={(e) => setEditForm({ ...editForm, current_goals: e.target.value })}
                        placeholder="e.g. Looking for a co-founder for a SaaS idea"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Availability</label>
                      <select
                        value={editForm.availability}
                        onChange={(e) => setEditForm({ ...editForm, availability: e.target.value })}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select availability</option>
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time (weekends)</option>
                        <option value="few-hours">A few hours a week</option>
                        <option value="exploring">Just exploring</option>
                      </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">Location</label>
                        <Input
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          placeholder="City, Country"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Website</label>
                        <Input
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          placeholder="https://yourwebsite.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold text-foreground">
                        {profile?.full_name || "Anonymous User"}
                      </h1>
                      <Button variant="outline" size="sm" onClick={startEditing}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    </div>
                    <p className="mt-1 text-muted-foreground">{user.email}</p>

                    {profile?.bio && (
                      <p className="mt-4 text-foreground">{profile.bio}</p>
                    )}

                    {/* Current Goals & Availability */}
                    {(profile?.current_goals || profile?.availability) && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {profile?.current_goals && (
                          <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                            <span className="text-xs font-medium text-primary block mb-0.5">Looking for</span>
                            <span className="text-foreground">{profile.current_goals}</span>
                          </div>
                        )}
                        {profile?.availability && (
                          <div className="rounded-lg bg-secondary px-3 py-2 text-sm">
                            <span className="text-xs font-medium text-muted-foreground block mb-0.5">Availability</span>
                            <span className="text-foreground capitalize">{profile.availability.replace(/-/g, " ")}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {profile?.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {profile.location}
                        </div>
                      )}
                      {profile?.website && (
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <LinkIcon className="h-4 w-4" />
                          {profile.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-border bg-secondary/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground">I can help with</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {profile?.skills?.length ? `${profile.skills.length} skills` : "Add skills"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-secondary/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground">I want to build</p>
                        <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">
                          {profile?.current_goals || "Add a goal"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-secondary/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Availability</p>
                        <p className="mt-1 text-sm font-semibold capitalize text-foreground">
                          {profile?.availability ? profile.availability.replace(/-/g, " ") : "Set availability"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Skills Section */}
            <div className="mt-6 border-t border-border pt-6">
              <h3 className="mb-3 font-semibold text-foreground">Skills</h3>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {availableSkills.map((skill) => (
                    <Badge
                      key={skill}
                      variant={editForm.skills.includes(skill) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSkill(skill)}
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : profile?.skills && profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No skills added yet</p>
              )}
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-6">
                <Button variant="outline" onClick={cancelEditing}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Projects I started
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Ideas you turned into public project briefs.</p>
              </div>
              <Badge variant="secondary">{myProjects?.length || 0}</Badge>
            </div>
            {myProjects && myProjects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {myProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold text-foreground">No projects yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start your first project and find collaborators.</p>
                <Button asChild className="mt-4">
                  <Link href="/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </Link>
                </Button>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Teams I joined
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Projects where you are part of the working team.</p>
              </div>
              <Badge variant="secondary">{joinedTeams?.length || 0}</Badge>
            </div>
            {joinedTeams && joinedTeams.length > 0 ? (
              <div className="space-y-3">
                {joinedTeams.map((membership) => (
                  <div key={membership.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Link
                          href={`/project/${membership.team?.project?.id}`}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {membership.team?.project?.title}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">{membership.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{membership.team?.project?.status}</Badge>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/project/${membership.team?.project?.id}`}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold text-foreground">Not in any teams yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Explore projects and join teams that match your skills.</p>
                <Button asChild className="mt-4">
                  <Link href="/explore">Explore Projects</Link>
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
