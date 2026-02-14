import React, { createContext, useContext, useState } from 'react'
import translations, { type Lang } from '../i18n/translations'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: keyof typeof translations['en']) => string
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key as string,
  isRTL: false
})

export function LanguageProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [lang, setLang] = useState<Lang>('en')

  const t = (key: keyof typeof translations['en']): string => {
    return (translations[lang] as Record<string, string>)[key as string] ?? (key as string)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL: lang === 'ar' }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className={lang === 'ar' ? 'font-arabic' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

export function useLang(): LanguageContextType {
  return useContext(LanguageContext)
}
