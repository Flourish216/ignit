"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useLanguage } from "@/lib/i18n/context"

interface ProjectCardProps {
  project: {
    id: string
    title: string
    description: string | null
    required_roles: string[]
    ai_breakdown?: {
      one_liner?: string
      roles?: Array<{ title: string; skills?: string[] }>
    } | null
    status: string
    created_at: string
    owner: {
      id: string
      full_name: string | null
      avatar_url: string | null
    } | null
    member_count?: number
  }
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  recruiting: { label: "Recruiting", variant: "default" },
  in_progress: { label: "In Progress", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
}

const statusZh: Record<string, string> = {
  draft: "草稿",
  recruiting: "开放中",
  in_progress: "已开始",
  completed: "完成",
  archived: "已归档",
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { language } = useLanguage()
  const isZh = language === "zh"
  const status = statusConfig[project.status] || statusConfig.draft
  const oneLiner = project.ai_breakdown?.one_liner || project.description || (isZh ? "还没有简介。" : "No description provided")
  const roles = project.ai_breakdown?.roles?.map((role) => role.title) || project.required_roles || []

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="group h-full border-border/80 transition-colors hover:border-primary/40">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-semibold text-foreground group-hover:text-primary">
                {project.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{oneLiner}</p>
            </div>
            <Badge variant={status.variant} className="shrink-0">
              {isZh ? statusZh[project.status] || status.label : status.label}
            </Badge>
          </div>

          {roles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {roles.slice(0, 3).map((role, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {role}
                </Badge>
              ))}
              {roles.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{roles.length - 3}
                </Badge>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            {project.owner ? (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={project.owner.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {project.owner.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-muted-foreground">
                  {project.owner.full_name || (isZh ? "匿名用户" : "Anonymous")}
                </span>
              </div>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(project.created_at), { addSuffix: true, locale: isZh ? zhCN : undefined })}
              <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
