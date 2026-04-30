"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Calendar, MapPin, UserRound } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

type IntentBreakdown = {
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

interface IntentCardProps {
  intent: {
    id: string
    title: string
    description: string | null
    status: string
    created_at: string
    ai_breakdown?: IntentBreakdown | null
    owner: {
      id: string
      full_name: string | null
      avatar_url: string | null
    } | null
  }
}

const getStatusLabel = (status: string, intentStatus?: string) => {
  if (intentStatus) return intentStatus
  if (status === "recruiting") return "open"
  if (status === "in_progress") return "matched"
  return status
}

export function IntentCard({ intent }: IntentCardProps) {
  const details = intent.ai_breakdown || {}
  const title = details.title || intent.title
  const description = details.description || intent.description || "No description yet."
  const status = getStatusLabel(intent.status, details.status)

  return (
    <Link href={`/project/${intent.id}`}>
      <Card className="group h-full border-border/80 bg-card transition-colors hover:border-primary/50">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{details.category || "Other"}</Badge>
                <Badge variant="outline" className="capitalize">{status}</Badge>
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

          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            {intent.owner ? (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={intent.owner.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {intent.owner.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-muted-foreground">
                  {intent.owner.full_name || "Anonymous"}
                </span>
              </div>
            ) : (
              <span />
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(intent.created_at), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
