import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import he from './he'
import en from './en'

const savedLang = localStorage.getItem('crewcash_lang') || 'he'

i18n.use(initReactI18next).init({
  resources: { he, en },
  lng: savedLang,
  fallbackLng: 'he',
  interpolation: { escapeValue: false }
})

export default i18n
