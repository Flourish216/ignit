"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Calendar, MapPin, UserRound } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

type SparkBreakdown = {
  title?: string
  category?: string
  description?: string
  location?: string
  time_availability?: string
  looking_for?: string
  vibe?: string
  commitment?: string
  status?: string
}

interface SparkCardProps {
  spark: {
    id: string
    title: string
    description: string | null
    status: string
    created_at: string
    ai_breakdown?: SparkBreakdown | null
    owner: {
      id: string
      full_name: string | null
      avatar_url: string | null
    } | null
    fitReasons?: string[]
    fitScore?: number
  }
}

const getStatusLabel = (status: string, sparkStatus?: string) => {
  if (sparkStatus) return sparkStatus
  if (status === "recruiting") return "open"
  if (status === "in_progress") return "matched"
  return status
}

export function SparkCard({ spark }: SparkCardProps) {
  const details = spark.ai_breakdown || {}
  const title = details.title || spark.title
  const description = details.description || spark.description || "No description yet."
  const status = getStatusLabel(spark.status, details.status)

  return (
    <Link href={`/project/${spark.id}`}>
      <Card className="group h-full border-border/80 bg-card transition-colors hover:border-primary/50">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{details.category || "Other"}</Badge>
                <Badge variant="outline" className="capitalize">{status}</Badge>
                {Boolean(spark.fitReasons?.length) && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/15">Good fit</Badge>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 text-base font-semibold text-foreground group-hover:text-primary">
                {title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{details.location || "Flexible"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{details.time_availability || "Flexible"}</span>
            </div>
            <div className="flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{details.looking_for || "Someone interested"}</span>
            </div>
          </div>

          {(details.vibe || details.commitment) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {details.vibe && (
                <Badge variant="outline" className="text-xs font-normal">{details.vibe}</Badge>
              )}
              {details.commitment && (
                <Badge variant="outline" className="text-xs font-normal">{details.commitment}</Badge>
              )}
            </div>
          )}

          {Boolean(spark.fitReasons?.length) && (
            <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs font-medium text-primary">Why it fits</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground">
                {spark.fitReasons?.slice(0, 2).join(" · ")}
              </p>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            {spark.owner ? (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={spark.owner.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {spark.owner.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-muted-foreground">
                  {spark.owner.full_name || "Anonymous"}
                </span>
              </div>
            ) : (
              <span />
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(spark.created_at), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
