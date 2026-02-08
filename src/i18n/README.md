# CropChain Internationalization (i18n)

This directory contains the internationalization configuration and translation files for CropChain.

## 📁 Structure

```
src/i18n/
├── config.ts          # i18n configuration and initialization
├── locales/           # Translation files
│   ├── en.json       # English translations
│   └── hi.json       # Hindi translations
└── README.md         # This file
```

## 🌍 Supported Languages

- **English (en)** - Default language
- **Hindi (hi)** - हिंदी

## 🚀 Usage

### In Components

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('home.welcome')}</h1>
      <p>{t('home.description')}</p>
    </div>
  );
}
```

### Language Switching

The `LanguageSwitcher` component is available in the header. Users can switch languages by clicking on it.

Language preference is automatically saved to `localStorage` and persists across sessions.

## ➕ Adding a New Language

1. Create a new JSON file in `src/i18n/locales/` (e.g., `ta.json` for Tamil)
2. Copy the structure from `en.json` and translate all values
3. Import the new translation in `src/i18n/config.ts`:

```typescript
import taTranslations from './locales/ta.json';
```

4. Add it to the resources object:

```typescript
resources: {
  en: { translation: enTranslations },
  hi: { translation: hiTranslations },
  ta: { translation: taTranslations }, // New language
}
```

5. Update the `LanguageSwitcher` component to include the new language:

```typescript
const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' }, // New language
];
```

## 🎨 Font Support

The application uses:
- **Inter** - For Latin scripts (English)
- **Noto Sans Devanagari** - For Devanagari script (Hindi)

These fonts are loaded via Google Fonts in `src/index.css`.

For additional scripts, add the appropriate Google Font or system font in the CSS.

## 🔑 Translation Keys Structure

```json
{
  "app": { ... },           // App-level strings
  "nav": { ... },           // Navigation items
  "common": { ... },        // Common UI elements
  "home": { ... },          // Home page
  "auth": { ... },          // Authentication
  "batch": { ... },         // Batch operations
  "status": { ... },        // Supply chain statuses
  "actors": { ... },        // Supply chain actors
  "admin": { ... },         // Admin dashboard
  "chatbot": { ... },       // AI Chatbot
  "errors": { ... }         // Error messages
}
```

## 🔍 Best Practices

1. **Always use translation keys** - Never hardcode strings in components
2. **Keep keys organized** - Group related translations together
3. **Use descriptive keys** - `auth.loginButton` is better than `button1`
4. **Maintain consistency** - Use the same key structure across all language files
5. **Test with both languages** - Ensure UI doesn't break with longer translations

## 🌐 SEO Considerations

The language is set on the `<html>` element's `lang` attribute when changed:

```typescript
document.documentElement.setAttribute('lang', languageCode);
```

For better SEO, consider adding:
- `hreflang` tags in the HTML head
- Language-specific meta descriptions
- Sitemap with language variants

## 📝 Notes

- Language preference is stored in `localStorage` with key `language`
- The language detector checks `localStorage` first, then browser language
- Fallback language is English if translation is missing
- The app supports RTL languages (add `dir="rtl"` logic if needed)
