export function formatDate(dateStr: string, locale: string = 'zh-TW'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  // Date-only strings parse as UTC midnight; format in UTC too, or western time zones
  // show the previous day (and mismatch the statically rendered HTML).
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
