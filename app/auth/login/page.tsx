'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { useLanguage } from '@/lib/i18n/context'

function LoginForm() {
  const { language } = useLanguage()
  const isZh = language === 'zh'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/explore'
  const isConfirmed = searchParams.get('confirmed') === '1'
  const authErrorDescription = searchParams.get('error_description')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push(redirectTo)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      const normalizedMessage = message.toLowerCase()

      if (normalizedMessage.includes('email not confirmed') || normalizedMessage.includes('not confirmed')) {
        setError(isZh ? '邮箱还没确认。请先打开确认邮件，再回来登录。' : 'Please confirm your email before logging in.')
      } else {
        setError(message || (isZh ? '登录失败，请再试一次。' : 'An error occurred'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{isZh ? '登录' : 'Login'}</CardTitle>
              <CardDescription>
                {isZh ? '登录后就能发布 Spark、回应别人、进入工作区。' : 'Enter your email below to login to your account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{isZh ? '邮箱' : 'Email'}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">{isZh ? '密码' : 'Password'}</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {isConfirmed && (
                    <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                      {isZh ? '邮箱已确认，可以登录了。' : 'Email confirmed. You can log in now.'}
                    </p>
                  )}
                  {authErrorDescription && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {isZh ? '确认链接无效或已过期，请重新注册或重新发送确认邮件。' : authErrorDescription}
                    </p>
                  )}
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? isZh ? '登录中...' : 'Logging in...' : isZh ? '登录' : 'Login'}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  {isZh ? '还没有账号？' : 'Don’t have an account?'}{' '}
                  <Link
                    href="/auth/sign-up"
                    className="underline underline-offset-4"
                  >
                    {isZh ? '注册' : 'Sign up'}
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
