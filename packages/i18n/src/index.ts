import tr from '../locales/tr.json';
import en from '../locales/en.json';

export type Messages = typeof tr;
export const LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends string ? never : { [K in keyof T]: T[K] extends string ? K : Join<K, Leaves<T[K]>> }[keyof T];
/** Every valid dotted message key, e.g. `listing.conditions.NEW`. */
export type MessageKey = Leaves<Messages>;

type Dict = { [key: string]: string | Dict };
const dictionaries: Record<Locale, Dict> = { tr, en };

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Creates a translator. Missing keys fall back to Turkish, then to the key itself. */
export function createT(locale: Locale = DEFAULT_LOCALE): TFunction {
  const dict = dictionaries[locale];
  return (key, params) => {
    const template = lookup(dict, key) ?? lookup(dictionaries.tr, key) ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  };
}

/** Looser variant for dynamic keys (e.g. API error codes); returns `fallback` when missing. */
export function translateDynamic(t: TFunction, key: string, fallback: string): string {
  const result = t(key as MessageKey);
  return result === key ? fallback : result;
}

export const t = createT('tr');
export { tr as trMessages };
