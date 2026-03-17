"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, Plus, Loader2, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"
import Link from "next/link"

const statusFilters = [
  { value: "all", label: "All Projects" },
  { value: "recruiting", label: "Recruiting" },
  { value: "in_progress", label: "In Progress" },
]

const popularSkills = [
  "React", "Node.js", "Python", "Design", "Marketing", "Mobile", "AI/ML", "Backend"
]

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const supabase = createClient()

  const { data: projects, isLoading } = useSWR(
    ["projects", statusFilter, searchQuery],
    async () => {
      let query = supabase
        .from("projects")
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false })

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
    { revalidateOnFocus: false }
  )

  const filteredProjects = projects?.filter((project) => {
    if (selectedSkills.length === 0) return true
    return project.required_roles.some((role: string) =>
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
              Discover projects looking for collaborators like you
            </p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              Start a Project
            </Link>
          </Button>
        </div>

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
                <ProjectCard key={project.id} project={project} />
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
