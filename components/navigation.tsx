"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Compass, Home, LogOut, Mail, Plus, Search, Sparkles, User, Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useLanguage } from "@/lib/i18n/context"
import { LanguageSwitcher } from "@/components/language-switcher"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")

  const navItems = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/explore", label: t.nav.explore, icon: Compass },
    { href: "/teams", label: t.nav.teams, icon: Users },
  ]

  const { data: user } = useSWR("user", async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  })

  const { data: profile } = useSWR(user ? `profile-${user.id}` : null, async () => {
    if (!user) return null
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    return data
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const getInitial = () =>
    profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchQuery.trim()
    router.push(query ? `/explore?search=${encodeURIComponent(query)}` : "/explore")
  }

  const UserMenu = ({ align = "end" }: { align?: "end" | "start" }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "relative rounded-full p-0",
            align === "start" ? "h-11 w-full justify-start gap-3 rounded-lg px-2" : "h-9 w-9"
          )}
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitial()}
            </AvatarFallback>
          </Avatar>
          {align === "start" && (
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium text-foreground">
                {profile?.full_name || "User"}
              </div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <div className="flex items-center gap-2 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitial()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium">{profile?.full_name || "User"}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            {t.nav.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/teams" className="cursor-pointer">
            <Users className="mr-2 h-4 w-4" />
            {t.nav.myTeams}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const MessageButton = ({ compact = false }: { compact?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href={user ? "/teams" : "/auth/login?redirect=/teams"} aria-label={t.nav.messages}>
            <Mail className="h-4 w-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      {!compact && <TooltipContent>{t.nav.messages}</TooltipContent>}
    </Tooltip>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">Ignit</span>
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-3 py-4">
          <Button asChild className="h-10 justify-start gap-2">
            <Link href="/create">
              <Plus className="h-4 w-4" />
              {t.nav.newProject}
            </Link>
          </Button>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
            {user && (
              <Link
                href="/profile"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive("/profile")
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <User className="h-4 w-4" />
                {t.nav.profile}
              </Link>
            )}
          </nav>
        </div>
      </aside>

      <header className="sticky top-0 z-40 hidden h-16 items-center justify-end gap-3 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:flex">
        <form onSubmit={handleSearch} className="relative w-72 xl:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.nav.searchProjects}
            className="h-10 rounded-lg bg-card pl-10"
          />
        </form>

        <TooltipProvider>
          <div className="flex items-center gap-2">
            <MessageButton />
            <LanguageSwitcher />
            {user ? (
              <UserMenu />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild size="sm">
                  <Link href="/auth/login">{t.nav.signIn}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/sign-up">{t.nav.getStarted}</Link>
                </Button>
              </div>
            )}
          </div>
        </TooltipProvider>
      </header>

      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">Ignit</span>
          </Link>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link href="/explore" aria-label={t.nav.searchProjects}>
                  <Search className="h-4 w-4" />
                </Link>
              </Button>
              <MessageButton compact />
            </TooltipProvider>
            <LanguageSwitcher />
            {user ? (
              <>
                <Button asChild size="icon" className="h-9 w-9">
                  <Link href="/create" aria-label={t.nav.newProject}>
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
                <UserMenu />
              </>
            ) : (
              <>
                <Button variant="ghost" asChild size="sm">
                  <Link href="/auth/login">{t.nav.signIn}</Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/auth/sign-up">{t.nav.getStarted}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
