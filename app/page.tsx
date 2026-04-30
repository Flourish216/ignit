"use client"

import { Navigation } from "@/components/navigation"
import { IdeaInput } from "@/components/idea-input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Compass, Lightbulb, MessageSquare } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

export default function HomePage() {
  const { t } = useLanguage()
  const stepIcons = [Lightbulb, Compass, MessageSquare]

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Navigation />
      <main>
        <section className="px-4 pb-12 pt-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                {t.mainline.title}
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                {t.mainline.subtitle}
              </p>
            </div>

            <div className="mt-10 flex justify-center">
              <IdeaInput />
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/explore">
                  {t.cta.exploreProjects}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/30 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {t.mainline.steps.map((step, index) => {
              const Icon = stepIcons[index]
              return (
                <div key={step.title} className="rounded-lg border border-border bg-background p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t.cta.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.cta.subtitle}</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/create">
                {t.nav.newProject}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
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
