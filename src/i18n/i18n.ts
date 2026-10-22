import i18n from 'i18next';
import type { ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { terminologyPostProcessor } from './terminology';
import { logError } from '../utils/log';

import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';
import fi from './fi.json';
import nb from './nb.json';
import zh from './zh.json';
import ja from './ja.json';
import ru from './ru.json';
import uk from './uk.json';
import it from './it.json';
import ms from './ms.json';
import th from './th.json';
import tr from './tr.json';
import vi from './vi.json';
import zhHant from './zhHant.json';
import nl from './nl.json';
import is from './is.json';
import hi from './hi.json';
import af from './af.json';
import ko from './ko.json';
import sv from './sv.json';
import pl from './pl.json';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'nl', 'pt', 'fi', 'sv', 'nb', 'is', 'it', 'pl', 'tr', 'ms', 'vi', 'th', 'hi', 'af', 'zh', 'zhHant', 'ja', 'ko', 'ru', 'uk'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const isSupportedLanguage = (v: unknown): v is SupportedLanguage => SUPPORTED_LANGUAGES.some(l => l === v);
export const i18nCode = (lang: SupportedLanguage): string => (lang === 'zhHant' ? 'zh-Hant' : lang);

const TRANSLATIONS: Record<SupportedLanguage, ResourceKey> = { en, es, fr, de, nl, pt, fi, sv, nb, is, it, pl, tr, ms, vi, th, hi, af, zh, zhHant, ja, ko, ru, uk };

export const getDeviceLanguage = (): SupportedLanguage => {
  const full = navigator.language || 'en';
  if (/^zh\b/i.test(full) && /(Hant|TW|HK|MO)/i.test(full)) return 'zhHant';
  const code = full.split('-')[0];
  if (isSupportedLanguage(code)) return code;
  if (code === 'no' || code === 'nn') return 'nb';
  return 'en';
};

i18n
  .use(initReactI18next)
  .use(terminologyPostProcessor)
  .init({
    resources: Object.fromEntries(SUPPORTED_LANGUAGES.map((lang): [string, { translation: ResourceKey }] => [i18nCode(lang), { translation: TRANSLATIONS[lang] }])),
    lng: i18nCode(getDeviceLanguage()),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
    postProcess: ['terminology'],
  })
  .catch(e => logError('i18n', e));

document.documentElement.lang = i18n.language;

export const changeLanguage = (lang: SupportedLanguage): void => {
  const code = i18nCode(lang);
  i18n.changeLanguage(code).catch(e => logError('i18n', e));
  document.documentElement.lang = code;
};

export default i18n;
