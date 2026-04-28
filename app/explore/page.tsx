"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, Plus, Loader2, Sparkles, Target } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"
import Link from "next/link"

const statusFilters = [
  { value: "all", label: "All Projects" },
  { value: "recruiting", label: "Recruiting" },
  { value: "in_progress", label: "In Progress" },
]

const popularSkills = [
  "Design", "Marketing", "Writing", "Video", "Community", "Product", "AI/ML", "No-code"
]

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const supabase = createClient()

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  })

  const { data: myProfile } = useSWR(user ? `explore-profile-${user.id}` : null, async () => {
    if (!user) return null
    const { data } = await supabase
      .from("profiles")
      .select("id, skills, interests, current_goals, availability, location")
      .eq("id", user.id)
      .single()
    return data
  })

  const { data: projects, isLoading } = useSWR(
    ["projects", statusFilter, searchQuery],
    async () => {
      let query = supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Projects fetch error:", error)
        throw error
      }
      return data
    },
    { revalidateOnFocus: false }
  )

  // Fetch owner profiles separately
  const { data: ownerProfiles } = useSWR(
    projects ? ["owner-profiles", projects.map(p => p.owner_id)] : null,
    async () => {
      if (!projects || projects.length === 0) return {}
      
      const ownerIds = [...new Set(projects.map(p => p.owner_id))]
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ownerIds)
      
      if (error) {
        console.error("Owner profiles fetch error:", error)
        return {}
      }
      
      // Create a map for quick lookup
      const profileMap: Record<string, any> = {}
      data?.forEach(profile => {
        profileMap[profile.id] = profile
      })
      return profileMap
    }
  )

  // Combine projects with owner data
  const projectsWithOwners = projects?.map(project => {
    const breakdown = project.ai_breakdown || {}
    const roleSkills: string[] = Array.isArray(breakdown.roles)
      ? breakdown.roles.flatMap((role: any) => Array.isArray(role.skills) ? role.skills : [])
      : []
    const roleTitles: string[] = Array.isArray(breakdown.roles)
      ? breakdown.roles.map((role: any) => role.title).filter(Boolean)
      : Array.isArray(project.required_roles) ? project.required_roles : []
    const mySkills: string[] = Array.isArray(myProfile?.skills) ? myProfile.skills : []
    const myInterests: string[] = Array.isArray(myProfile?.interests) ? myProfile.interests : []
    const normalizedSkills = roleSkills.map((skill) => skill.toLowerCase())
    const text = `${project.title} ${project.description || ""} ${breakdown.one_liner || ""}`.toLowerCase()
    const matchedSkills = mySkills.filter((skill) =>
      normalizedSkills.some((required) => required.includes(skill.toLowerCase()) || skill.toLowerCase().includes(required))
    )
    const matchedInterests = myInterests.filter((interest) => text.includes(interest.toLowerCase()))
    const matchReasons = [
      ...(matchedSkills.length ? [`${matchedSkills.length} skill match${matchedSkills.length > 1 ? "es" : ""}: ${matchedSkills.slice(0, 3).join(", ")}`] : []),
      ...(matchedInterests.length ? [`Interest overlap: ${matchedInterests.slice(0, 2).join(", ")}`] : []),
      ...(myProfile?.availability ? [`Your availability is set to ${myProfile.availability.replace(/-/g, " ")}`] : []),
    ]

    return {
      ...project,
      required_roles: roleTitles,
      matchReasons: user && user.id !== project.owner_id ? matchReasons : [],
      matchedSkills,
      owner: ownerProfiles?.[project.owner_id] || null
    }
  })

  const filteredProjects = projectsWithOwners?.filter((project) => {
    if (selectedSkills.length === 0) return true
    const roles = Array.isArray(project.required_roles) ? project.required_roles : []
    return roles.some((role: string) =>
      selectedSkills.some((skill) => role.toLowerCase().includes(skill.toLowerCase()))
    )
  })

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Explore Projects</h1>
            <p className="mt-1 text-muted-foreground">
              Discover project briefs, open roles, and opportunities that fit your builder profile
            </p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              Start a Project
            </Link>
          </Button>
        </div>

        {myProfile && (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Good fit projects are based on your skills, interests, goals, availability, and location.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Keep your Builder Profile updated to improve recommendations.</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/profile">Edit profile</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mt-8 space-y-4">
          {/* Search and Status */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                {statusFilters.map((filter) => (
                  <TabsTrigger key={filter.value} value={filter.value}>
                    {filter.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Skill Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Skills:</span>
            </div>
            {popularSkills.map((skill) => (
              <Badge
                key={skill}
                variant={selectedSkills.includes(skill) ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </Badge>
            ))}
            {selectedSkills.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSkills([])}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProjects && filteredProjects.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project as any} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">No projects found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery || selectedSkills.length > 0
                  ? "Try adjusting your filters or search query"
                  : "Be the first to start a project!"}
              </p>
              <Button asChild className="mt-6">
                <Link href="/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create a Project
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
