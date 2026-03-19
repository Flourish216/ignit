"use client"

import { useLanguage } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === "en" ? "zh" : "en")}
      className="text-sm font-medium"
    >
      {language === "en" ? "中文" : "EN"}
    </Button>
  )
}
