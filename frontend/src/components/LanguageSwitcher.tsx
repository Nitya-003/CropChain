import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  ];

  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('language', languageCode);
    // Update document direction for RTL languages if needed
    document.documentElement.setAttribute('lang', languageCode);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className="relative shrink-0 group">
      <button
        className="flex h-9 items-center space-x-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-muted dark:bg-card sm:px-3"
        aria-label={t('common.selectLanguage')}
      >
        <Languages className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
      </button>

      {/* Dropdown Menu */}
      <div className="absolute right-0 mt-2 w-48 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="py-1">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => changeLanguage(language.code)}
              className={`w-full text-left px-4 py-2 text-xs hover:bg-muted transition-colors ${
                i18n.language === language.code
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{language.nativeName}</span>
                {i18n.language === language.code && (
                  <span className="text-primary">✓</span>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{language.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
