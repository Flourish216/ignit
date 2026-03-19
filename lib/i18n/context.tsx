"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { Language, translations } from "./translations"

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: typeof translations.en
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language
    if (saved === "en" || saved === "zh") setLanguageState(saved)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}
