import { Navigation } from "@/components/navigation"
import { IdeaInput } from "@/components/idea-input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Users, Lightbulb, Zap, Target } from "lucide-react"

const features = [
  {
    icon: Lightbulb,
    title: "Share Your Idea",
    description: "Describe your project in plain language. No technical details needed.",
  },
  {
    icon: Zap,
    title: "AI Breakdown",
    description: "Our AI analyzes your idea and creates a structured project plan with required roles.",
  },
  {
    icon: Users,
    title: "Find Your Team",
    description: "Connect with talented people who have the skills your project needs.",
  },
  {
    icon: Target,
    title: "Build Together",
    description: "Collaborate in dedicated team spaces with tools designed for productivity.",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8">
          {/* Background gradient */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Human-first, AI-assisted</span>
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Turn your ideas into{" "}
              <span className="text-primary">collaborative projects</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Describe what you want to build. Our AI will help break it down into actionable tasks and 
              connect you with the right people to make it happen.
            </p>

            <div className="mt-10 flex justify-center">
              <IdeaInput />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border bg-secondary/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground">How it works</h2>
              <p className="mt-3 text-muted-foreground">
                From idea to reality in four simple steps
              </p>
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

        {/* CTA Section */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Ready to start building?</h2>
            <p className="mt-3 text-muted-foreground">
              Join thousands of creators turning their ideas into reality
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/explore">
                  Explore Projects
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/sign-up">Create Account</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>Built with collaboration in mind. Powered by AI.</p>
        </div>
      </footer>
    </div>
  )
}
