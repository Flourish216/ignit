"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { Filter, Loader2, Plus, Search, Sparkles } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { SparkCard } from "@/components/spark-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const statusFilters = [
  { value: "all", label: "All" },
  { value: "recruiting", label: "Open" },
  { value: "in_progress", label: "Matched" },
]

const categories = ["Build", "Learn", "Move", "Go", "Create"]

function ExploreContent() {
  const searchParams = useSearchParams()
  const urlSearchQuery = searchParams.get("search") || ""
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    setSearchQuery(urlSearchQuery)
  }, [urlSearchQuery])

  const { data: intents, isLoading } = useSWR(
    ["intents", statusFilter, searchQuery],
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
      if (error) throw error
      return data || []
    },
    { revalidateOnFocus: false }
  )

  const { data: ownerProfiles } = useSWR(
    intents ? ["intent-owners", intents.map((intent) => intent.owner_id)] : null,
    async () => {
      if (!intents || intents.length === 0) return {}
      const ownerIds = [...new Set(intents.map((intent) => intent.owner_id))]
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ownerIds)

      if (error) return {}
      return Object.fromEntries((data || []).map((profile) => [profile.id, profile]))
    }
  )

  const intentsWithOwners = intents?.map((intent) => ({
    ...intent,
    owner: ownerProfiles?.[intent.owner_id] || null,
  }))

  const filteredIntents = intentsWithOwners?.filter((intent) => {
    if (selectedCategories.length === 0) return true
    const category = intent.ai_breakdown?.category || intent.tags?.[0] || "Other"
    return selectedCategories.includes(category)
  })

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    )
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Browse Sparks</h1>
            <p className="mt-1 text-muted-foreground">
              Find something meaningful to start with someone else.
            </p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              New Spark
            </Link>
          </Button>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Sparks..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex rounded-lg border border-border bg-card p-1">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    statusFilter === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Category:</span>
            </div>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategories.includes(category) ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => toggleCategory(category)}
              >
                {category}
              </Badge>
            ))}
            {selectedCategories.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredIntents && filteredIntents.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredIntents.map((intent) => (
                <SparkCard key={intent.id} spark={intent as any} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">No Sparks found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery || selectedCategories.length > 0
                  ? "Try a different search or category."
                  : "Post the first Spark."}
              </p>
              <Button asChild className="mt-6">
                <Link href="/create">
                  <Plus className="mr-2 h-4 w-4" />
                  New Spark
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background lg:pl-64"><Navigation /></div>}>
      <ExploreContent />
    </Suspense>
  )
}
