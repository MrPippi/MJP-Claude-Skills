import type { Language, Translations } from './types';
import { zhTW } from './locales/zh-TW';
import { en } from './locales/en';

export const translations: Record<Language, Translations> = { 'zh-TW': zhTW, en };

/** Replaces `{name}` placeholders. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
