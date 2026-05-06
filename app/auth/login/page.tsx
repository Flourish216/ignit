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
import { useEffect, useState, Suspense } from 'react'
import { useLanguage } from '@/lib/i18n/context'

function LoginForm() {
  const { language } = useLanguage()
  const isZh = language === 'zh'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code')
  const [codeSent, setCodeSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/explore'
  const isConfirmed = searchParams.get('confirmed') === '1'
  const authErrorDescription = searchParams.get('error_description')

  useEffect(() => {
    if (resendCooldown <= 0) return

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setNotice(null)

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

  const sendLoginCode = async () => {
    if (resendCooldown > 0) return

    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) throw error
      setCodeSent(true)
      setResendCooldown(60)
      setNotice(isZh ? '验证码已发送，去邮箱看一下。' : 'Code sent. Check your email.')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      const normalizedMessage = message.toLowerCase()

      if (normalizedMessage.includes('rate limit')) {
        setCodeSent(true)
        setResendCooldown(60)
        setError(isZh ? '验证码发得太频繁了。等 1 分钟再试。' : 'Too many code requests. Wait 1 minute and try again.')
      } else {
        setError(message || (isZh ? '验证码发送失败，请确认邮箱已注册。' : 'Could not send code. Make sure this email is registered.'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendLoginCode()
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    const token = otpCode.replace(/\s/g, '')

    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })

      if (error) throw error
      router.push(redirectTo)
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      setError(message || (isZh ? '验证码不对或已过期，请重新试一次。' : 'The code is incorrect or expired. Try again.'))
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
                {isZh ? '用邮箱验证码登录，不用记密码。' : 'Log in with an email code. No password needed.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('code')
                    setError(null)
                    setNotice(null)
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    loginMode === 'code'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isZh ? '验证码' : 'Email code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('password')
                    setError(null)
                    setNotice(null)
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    loginMode === 'password'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isZh ? '密码' : 'Password'}
                </button>
              </div>

              {loginMode === 'code' ? (
                <form onSubmit={codeSent ? handleVerifyCode : handleSendCode}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="email-code">{isZh ? '邮箱' : 'Email'}</Label>
                      <Input
                        id="email-code"
                        type="email"
                        placeholder="m@example.com"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setCodeSent(false)
                          setOtpCode('')
                          setResendCooldown(0)
                        }}
                      />
                    </div>
                    {codeSent && (
                      <div className="grid gap-2">
                        <Label htmlFor="otp-code">{isZh ? '验证码' : 'Code'}</Label>
                        <Input
                          id="otp-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          required
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-center text-lg tracking-[0.35em]"
                        />
                      </div>
                    )}
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
                    {notice && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        isLoading ||
                        (!codeSent && resendCooldown > 0) ||
                        (codeSent && otpCode.trim().length < 6)
                      }
                    >
                      {isLoading
                        ? isZh ? '处理中...' : 'Working...'
                        : codeSent
                          ? isZh ? '验证并登录' : 'Verify and log in'
                          : isZh ? '发送验证码' : 'Send code'}
                    </Button>
                    {codeSent && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        disabled={isLoading || resendCooldown > 0}
                        onClick={() => {
                          void sendLoginCode()
                        }}
                      >
                        {resendCooldown > 0
                          ? isZh ? `${resendCooldown} 秒后可重发` : `Send again in ${resendCooldown}s`
                          : isZh ? '重新发送验证码' : 'Send code again'}
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
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
                </form>
              )}

              <div className="mt-4 text-center text-sm">
                {isZh ? '还没有账号？' : 'Don’t have an account?'}{' '}
                <Link
                  href="/auth/sign-up"
                  className="underline underline-offset-4"
                >
                  {isZh ? '注册' : 'Sign up'}
                </Link>
              </div>
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
