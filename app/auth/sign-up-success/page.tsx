'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n/context'

export default function Page() {
  const { language } = useLanguage()
  const isZh = language === 'zh'

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {isZh ? '账号快好了' : 'Thank you for signing up!'}
              </CardTitle>
              <CardDescription>{isZh ? '去邮箱确认一下' : 'Check your email to confirm'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {isZh
                  ? '我们已经把确认邮件发过去了。确认后再回来登录，就可以开始发布 Spark。'
                  : 'You’ve successfully signed up. Please check your email to confirm your account before signing in.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
