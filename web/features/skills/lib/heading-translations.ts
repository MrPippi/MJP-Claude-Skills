/** Skill pages are authored in Chinese; these map their standard section headings for English readers. */
const HEADING_TRANSLATIONS: Record<string, string> = {
  '目的': 'Purpose',
  '平台需求': 'Platform Requirements',
  '產生的代碼': 'Generated Code',
  '觸發條件': 'Triggers',
  '輸入參數': 'Inputs',
  '輸出產物': 'Outputs',
  'NMS 版本需求': 'NMS Version Requirements',
  'Paper 版本需求': 'Paper Version Requirements',
  'Paperweight 建置設定': 'Build Setup',
  '建置設定': 'Build Setup',
  '代碼範本': 'Code Template',
  '推薦目錄結構': 'Recommended Directory Structure',
  '執行緒安全注意事項': 'Thread Safety',
  '失敗回退': 'Fallback',
  '技能名稱': 'Skill Name',
  '使用情境': 'Use Cases',
  '注意事項': 'Notes',
  '範例': 'Examples',
  '依賴宣告': 'Dependency Declaration',
  '執行緒安全': 'Thread Safety',
  '規則': 'Rules',
  '替代方案': 'Alternatives',
  '關鍵做法': 'Key Techniques',
  '傷害歸因矩陣': 'Damage Attribution Matrix',
  'Multi-module Gradle 結構': 'Multi-module Gradle Layout',
};

export function translateHeadingText(text: string): string {
  return HEADING_TRANSLATIONS[text.trim()] ?? text;
}

/** Rewrites h2/h3 text in rendered HTML (ids are left untouched so anchors stay stable). */
export function translateHeadingsHtml(html: string): string {
  return html.replace(/<(h[23])([^>]*)>([^<]+)<\/h[23]>/g, (_m, tag: string, attrs: string, text: string) => `<${tag}${attrs}>${translateHeadingText(text)}</${tag}>`);
}
