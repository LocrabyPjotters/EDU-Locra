import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import nlTranslation from './i18n/nl.json';
import enTranslation from './i18n/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: nlTranslation },
      en: { translation: enTranslation }
    },
    lng: 'nl', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
