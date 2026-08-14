import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const languages = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "hi", name: "Hindi", nativeName: "हिंदी" },
    { code: "mr", name: "Marathi", nativeName: "मराठी" },
  ];

  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem("language", languageCode);
    // Update document direction for RTL languages if needed
    document.documentElement.setAttribute("lang", languageCode);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const options = containerRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]'
    );
    if (!options || options.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = options[(index + 1) % options.length];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = options[(index - 1 + options.length) % options.length];
      prev?.focus();
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="flex h-9 items-center space-x-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-muted dark:bg-card sm:px-3"
        aria-label={t("common.selectLanguage")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
      >
        <Languages className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label={t("common.selectLanguage")}
          className="absolute right-0 mt-2 w-48 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border opacity-100 visible transition-all duration-200 z-50"
        >
          <div className="py-1">
            {languages.map((language, index) => (
              <button
                key={language.code}
                type="button"
                role="menuitem"
                onClick={() => changeLanguage(language.code)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`w-full text-left px-4 py-2 text-xs hover:bg-muted transition-colors ${
                  i18n.language === language.code
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{language.nativeName}</span>
                  {i18n.language === language.code && (
                    <span className="text-primary">✓</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {language.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;