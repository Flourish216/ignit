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
import { useLanguage } from "@/lib/i18n/context"

const statusFilterLabels = {
  en: { all: "All", recruiting: "Open", in_progress: "Matched" },
  zh: { all: "全部", recruiting: "开放中", in_progress: "已开始" },
}

const categories = ["Build", "Learn", "Move", "Go", "Create"]
const categoryLabels: Record<string, string> = {
  Build: "做东西",
  Learn: "学习",
  Move: "运动",
  Go: "出门",
  Create: "创作",
}

const goalsPrefix = "profile:goals:"
const availabilityPrefix = "profile:availability:"

function readStoredValue(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return ""
  const item = value.find((entry) => typeof entry === "string" && entry.startsWith(prefix))
  return typeof item === "string" ? item.slice(prefix.length) : ""
}

function tokenize(value: unknown) {
  if (!value) return []
  const text = Array.isArray(value) ? value.join(" ") : String(value)
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
}

function getFitForProfile(intent: any, profile: any) {
  if (!profile) return { score: 0, reasons: [] as string[] }

  const details = intent.ai_breakdown || {}
  const profileGoals = profile.current_goals || readStoredValue(profile.interests, goalsPrefix)
  const profileAvailability = profile.availability || readStoredValue(profile.skills, availabilityPrefix)
  const profileWords = new Set(tokenize([
    profile.bio,
    profile.location,
    profileGoals,
    profileAvailability,
    profile.skills,
    profile.interests,
  ]))
  const sparkWords = tokenize([
    details.title || intent.title,
    details.description || intent.description,
    details.category,
    details.location,
    details.time_availability,
    details.looking_for,
    details.vibe,
    details.commitment,
  ])

  const overlap = sparkWords.filter((word) => profileWords.has(word))
  const reasons: string[] = []
  let score = 0

  if (details.category && profileWords.has(String(details.category).toLowerCase())) {
    score += 3
    reasons.push(`interested in ${details.category}`)
  }

  if (overlap.length > 0) {
    score += Math.min(4, overlap.length)
    reasons.push(`shares ${overlap.slice(0, 3).join(", ")}`)
  }

  if (details.location && profile.location && String(details.location).toLowerCase().includes(String(profile.location).toLowerCase())) {
    score += 2
    reasons.push("near your location")
  }

  if (details.time_availability && profileAvailability) {
    score += 1
    reasons.push("availability may line up")
  }

  if (profileGoals && sparkWords.some((word) => tokenize(profileGoals).includes(word))) {
    score += 2
    reasons.push("matches what you want to start")
  }

  return { score, reasons: Array.from(new Set(reasons)).slice(0, 3) }
}

function ExploreContent() {
  const { language, t } = useLanguage()
  const isZh = language === "zh"
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
        .neq("status", "archived")
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

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  })

  const { data: currentProfile } = useSWR(
    user ? `explore-profile-${user.id}` : null,
    async () => {
      if (!user) return null
      const { data } = await supabase
        .from("profiles")
        .select("id, bio, skills, interests, location, current_goals, availability")
        .eq("id", user.id)
        .maybeSingle()
      return data
    },
    { revalidateOnFocus: false },
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

  const intentsWithOwners = intents?.map((intent) => {
    const fit = getFitForProfile(intent, currentProfile)
    return {
      ...intent,
      owner: ownerProfiles?.[intent.owner_id] || null,
      fitScore: fit.score,
      fitReasons: fit.reasons,
    }
  })

  const filteredIntents = intentsWithOwners
    ?.filter((intent) => {
      if (selectedCategories.length === 0) return true
      const category = intent.ai_breakdown?.category || intent.tags?.[0] || "Other"
      return selectedCategories.includes(category)
    })
    .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    )
  }
  const statusFilters = [
    { value: "all", label: statusFilterLabels[language].all },
    { value: "recruiting", label: statusFilterLabels[language].recruiting },
    { value: "in_progress", label: statusFilterLabels[language].in_progress },
  ]

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{isZh ? "发现 Spark" : "Browse Sparks"}</h1>
            <p className="mt-1 text-muted-foreground">
              {isZh ? "看看别人想开始什么，找到你也想加入的事。" : "Find something meaningful to start with someone else."}
            </p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              {t.nav.newProject}
            </Link>
          </Button>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <Input
                placeholder={t.nav.searchProjects}
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
              <span>{isZh ? "分类：" : "Category:"}</span>
            </div>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategories.includes(category) ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => toggleCategory(category)}
              >
                {isZh ? categoryLabels[category] || category : category}
              </Badge>
            ))}
            {selectedCategories.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="h-6 px-2 text-xs"
              >
                {isZh ? "清除" : "Clear"}
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
              <h3 className="mt-4 text-lg font-semibold text-foreground">{isZh ? "还没有找到 Spark" : "No Sparks found"}</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery || selectedCategories.length > 0
                  ? isZh ? "换个关键词或分类试试。" : "Try a different search or category."
                  : isZh ? "发布第一个 Spark。" : "Post the first Spark."}
              </p>
              <Button asChild className="mt-6">
                <Link href="/create">
                  <Plus className="mr-2 h-4 w-4" />
                  {t.nav.newProject}
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
