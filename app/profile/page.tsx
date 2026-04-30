"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Compass, Gamepad2, Loader2, MapPin, Music, Rocket, Sparkles, Zap } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { PixelCompanion } from "@/components/pixel-companion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

const fallbackTraits = [
  "good at product ideas",
  "likes live music",
  "moves fast",
  "looking for collaborators",
  "into gaming and design",
  "free on weekends",
]

const sparkCategories = [
  { name: "Build", description: "Start a product, tool, club, or small venture.", icon: Rocket },
  { name: "Learn", description: "Study, practice, or figure something out together.", icon: Sparkles },
  { name: "Move", description: "Gym, sports, walks, runs, and active routines.", icon: Zap },
  { name: "Go", description: "Concerts, city plans, campus events, short trips.", icon: Compass },
  { name: "Create", description: "Music, video, design, writing, games, and art.", icon: Music },
]

const floatingPositions = [
  "left-3 top-4 md:left-4 md:top-8",
  "right-3 top-20 md:right-2 md:top-10",
  "left-3 top-36 md:left-0 md:top-36",
  "right-3 bottom-28 md:right-0 md:top-36",
  "left-3 bottom-14 md:left-16 md:bottom-6",
  "right-3 bottom-4 md:right-12 md:bottom-8",
]

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const { data: user, isLoading: userLoading } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
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

  const { data: sparks } = useSWR(
    user ? `companion-sparks-${user.id}` : null,
    async () => {
      if (!user) return []
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, ai_breakdown, status, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3)
      return data || []
    }
  )

  const traitLines = useMemo(() => {
    const lines = [
      ...(profile?.skills || []).slice(0, 2).map((skill: string) => `good at ${skill.toLowerCase()}`),
      ...(profile?.interests || []).slice(0, 2).map((interest: string) => `into ${interest.toLowerCase()}`),
      profile?.current_goals || "looking for collaborators",
      profile?.availability ? `free ${profile.availability.replace(/-/g, " ")}` : "free on weekends",
    ].filter(Boolean)

    return [...lines, ...fallbackTraits].slice(0, 6)
  }, [profile])

  if (userLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background lg:pl-64">
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
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Badge variant="secondary" className="mb-4 gap-2">
              <Gamepad2 className="h-3.5 w-3.5" />
              Companion concept
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Your pixel self for starting things together.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              A Companion is a living snapshot of what you are good at, what you care about, and what Sparks you want to start.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{profile?.full_name || "Unnamed starter"}</p>
                <p className="text-sm text-muted-foreground">{profile?.location || "Location flexible"}</p>
              </div>
            </div>
          </div>

          <div className="relative min-h-[430px] overflow-hidden rounded-lg border border-border bg-card">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <PixelCompanion />
            </div>

            {traitLines.map((trait, index) => (
              <div
                key={`${trait}-${index}`}
                className={`absolute z-20 max-w-[150px] border-2 border-foreground bg-background px-3 py-2 text-xs font-medium shadow-[4px_4px_0_var(--foreground)] sm:max-w-[190px] ${floatingPositions[index]}`}
              >
                {trait}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Identity</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <IdentityRow label="Good at" value={(profile?.skills || []).slice(0, 4).join(", ") || "product ideas, design, planning"} />
              <IdentityRow label="Into" value={(profile?.interests || []).slice(0, 4).join(", ") || "live music, gaming, design"} />
              <IdentityRow label="Wants to start" value={profile?.current_goals || "something useful with collaborators"} />
              <IdentityRow label="Availability" value={profile?.availability?.replace(/-/g, " ") || "weekends and evenings"} />
              <IdentityRow label="Base" value={profile?.location || "campus / flexible"} icon={<MapPin className="h-4 w-4" />} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Spark categories</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sparks stay focused on starting something, not random social browsing.</p>
              </div>
              <Button asChild size="sm">
                <Link href="/create">Create Spark</Link>
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {sparkCategories.map((category) => {
                const Icon = category.icon
                return (
                  <div key={category.name} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">{category.name}</h3>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{category.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recent Sparks</h2>
              <p className="mt-1 text-sm text-muted-foreground">A front-end preview using your latest intents.</p>
            </div>
            <Badge variant="outline">{sparks?.length || 0} active</Badge>
          </div>

          {sparks && sparks.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {sparks.map((spark: any) => (
                <Card key={spark.id} className="border-border/80">
                  <CardContent className="p-4">
                    <Badge variant="secondary">{spark.ai_breakdown?.category || "Build"}</Badge>
                    <h3 className="mt-3 line-clamp-2 font-semibold text-foreground">{spark.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{spark.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
              <p className="font-medium text-foreground">No Sparks yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one to show what your Companion wants to start.</p>
              <Button asChild className="mt-4">
                <Link href="/create">Create Spark</Link>
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function IdentityRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-secondary/45 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="max-w-[60%] text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
