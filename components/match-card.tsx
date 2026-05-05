"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Sparkles, UserRound } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/context"

export interface MatchPerson {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio?: string | null
  skills?: string[] | null
  interests?: string[] | null
  current_goals?: string | null
  availability?: string | null
  location?: string | null
  matchedSkills?: string[]
  matchedInterests?: string[]
  matchReasons?: string[]
  matchCount?: number
}

interface MatchCardProps {
  person: MatchPerson
  compact?: boolean
}

export function MatchCard({ person, compact = false }: MatchCardProps) {
  const { language } = useLanguage()
  const isZh = language === "zh"
  const reasons = person.matchReasons?.length
    ? person.matchReasons
    : [
        ...(person.matchedSkills?.length ? [isZh ? `${person.matchedSkills.length} 个技能对得上` : `${person.matchedSkills.length} skill match`] : []),
        ...(person.availability ? [isZh ? `时间：${person.availability.replace(/-/g, " ")}` : `Available: ${person.availability.replace(/-/g, " ")}`] : []),
      ]

  return (
    <Card className="border-border/80">
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start gap-3">
          <Avatar className={compact ? "h-9 w-9" : "h-11 w-11"}>
            <AvatarImage src={person.avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {person.full_name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {person.full_name || (isZh ? "匿名用户" : "Anonymous builder")}
                </p>
                {person.bio && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{person.bio}</p>
                )}
              </div>
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            </div>

            {reasons.length > 0 && (
              <div className="mt-3 space-y-1">
                {reasons.slice(0, compact ? 2 : 3).map((reason, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {reason}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1">
              {(person.matchedSkills || person.skills || []).slice(0, 4).map((skill, index) => (
                <Badge key={`${skill}-${index}`} variant="secondary" className="text-[10px]">
                  {skill}
                </Badge>
              ))}
            </div>

            {!compact && (
              <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                {person.current_goals && (
                  <div className="flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5" />
                    <span className="line-clamp-1">{person.current_goals}</span>
                  </div>
                )}
                {person.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{person.location}</span>
                  </div>
                )}
              </div>
            )}

            {!compact && (
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href={`/profile?builder=${person.id}`}>{isZh ? "查看主页" : "View builder profile"}</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
