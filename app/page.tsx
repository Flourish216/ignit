"use client"

import { Navigation } from "@/components/navigation"
import { IdeaInput } from "@/components/idea-input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Users, Lightbulb, Zap, Target } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

export default function HomePage() {
  const { t } = useLanguage()

  const features = [
    { icon: Lightbulb, title: t.features.shareIdea.title, description: t.features.shareIdea.description },
    { icon: Zap, title: t.features.aiBreakdown.title, description: t.features.aiBreakdown.description },
    { icon: Users, title: t.features.findTeam.title, description: t.features.findTeam.description },
    { icon: Target, title: t.features.buildTogether.title, description: t.features.buildTogether.description },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">{t.hero.badge}</span>
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t.hero.title}{" "}
              <span className="text-primary">{t.hero.titleHighlight}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              {t.hero.description}
            </p>
            <div className="mt-10 flex justify-center">
              <IdeaInput />
            </div>
          </div>
        </section>
        <section className="border-t border-border bg-secondary/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground">{t.features.title}</h2>
              <p className="mt-3 text-muted-foreground">{t.features.subtitle}</p>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div key={index} className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                    {index < features.length - 1 && (
                      <div className="absolute right-0 top-7 hidden h-0.5 w-8 -translate-x-4 bg-border lg:block" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-foreground">{t.cta.title}</h2>
            <p className="mt-3 text-muted-foreground">{t.cta.subtitle}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/explore">{t.cta.exploreProjects}<ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/sign-up">{t.cta.createAccount}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>{t.footer}</p>
        </div>
      </footer>
    </div>
  )
}
