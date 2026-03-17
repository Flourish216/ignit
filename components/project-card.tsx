"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Calendar, ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ProjectCardProps {
  project: {
    id: string
    title: string
    description: string | null
    required_roles: string[]
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

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status] || statusConfig.draft

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="group h-full transition-all hover:border-primary/50 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="line-clamp-2 font-semibold text-foreground group-hover:text-primary">
                {project.title}
              </h3>
              <Badge variant={status.variant} className="mt-2">
                {status.label}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description || "No description provided"}
          </p>

          {project.required_roles.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Looking for:</p>
              <div className="flex flex-wrap gap-1">
                {project.required_roles.slice(0, 3).map((role, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {role}
                  </Badge>
                ))}
                {project.required_roles.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{project.required_roles.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-3">
            {project.owner && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={project.owner.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {project.owner.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  {project.owner.full_name || "Anonymous"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
            </div>
            <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
