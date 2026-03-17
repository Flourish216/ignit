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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  "React", "Next.js", "TypeScript", "Node.js", "Python", "Go", "Rust",
  "UI/UX Design", "Product Design", "Graphic Design", "Illustration",
  "Marketing", "Growth", "Sales", "Content Writing", "SEO",
  "AI/ML", "Data Science", "DevOps", "Mobile Development", "Backend",
  "Project Management", "Business Strategy", "Finance"
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

  const { data: myProjects } = useSWR(
    user ? `my-projects-${user.id}` : null,
    async () => {
      if (!user) return []
      const { data } = await supabase
        .from("projects")
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url)
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
      return data || []
    }
  )

  const { data: joinedTeams } = useSWR(
    user ? `joined-teams-${user.id}` : null,
    async () => {
      if (!user) return []
      const { data } = await supabase
        .from("team_members")
        .select(`
          *,
          team:teams!team_members_team_id_fkey(
            id,
            name,
            project:projects!teams_project_id_fkey(
              id,
              title,
              description,
              status,
              owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url)
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
      return data || []
    }
  )

  const startEditing = () => {
    setEditForm({
      full_name: profile?.full_name || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      website: profile?.website || "",
      skills: profile?.skills || [],
      interests: profile?.interests || [],
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

        {/* Projects Tabs */}
        <Tabs defaultValue="my-projects">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="my-projects" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              My Projects
            </TabsTrigger>
            <TabsTrigger value="joined" className="gap-2">
              <Users className="h-4 w-4" />
              Joined Teams
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-projects" className="mt-6">
            {myProjects && myProjects.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {myProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold text-foreground">No projects yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start your first project and find collaborators
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/create">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Project
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="joined" className="mt-6">
            {joinedTeams && joinedTeams.length > 0 ? (
              <div className="space-y-4">
                {joinedTeams.map((membership) => (
                  <Card key={membership.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Link
                            href={`/project/${membership.team?.project?.id}`}
                            className="font-semibold text-foreground hover:text-primary"
                          >
                            {membership.team?.project?.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">{membership.role}</p>
                        </div>
                        <Badge variant="secondary">{membership.team?.project?.status}</Badge>
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
                    Explore projects and join teams that match your skills
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/explore">Explore Projects</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
