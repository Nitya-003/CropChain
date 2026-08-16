"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<string>("en");
  const { i18n } = useTranslation();

  useEffect(() => {
    // Get initial language from i18n
    const currentLang = i18n.resolvedLanguage || i18n.language || "en";
    setLang(currentLang);

    // Update the html lang attribute when language changes
    if (typeof document !== "undefined") {
      document.documentElement.lang = currentLang;
    }

    // Listen for language changes
    const handleLanguageChange = (lng: string) => {
      setLang(lng);
      if (typeof document !== "undefined") {
        document.documentElement.lang = lng;
      }
    };

    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, [i18n]);

  return <>{children}</>;
}
