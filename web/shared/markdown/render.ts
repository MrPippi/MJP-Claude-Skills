import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { Root, Element } from 'hast';
import type { VFile } from 'vfile';

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderOptions {
  /** Rewrites every link href (e.g. relative `.md` links → site routes). */
  resolveLink?: (href: string) => string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

const LANGS = ['java', 'groovy', 'kotlin', 'yaml', 'json', 'bash', 'shell', 'xml', 'properties', 'toml', 'sql', 'diff', 'markdown'] as const;
const LANG_ALIAS: Record<string, string> = { gradle: 'groovy', sh: 'bash', yml: 'yaml', kts: 'kotlin' };
const PLAIN = 'text';

/** Maps a fence language to one Shiki has loaded; anything else renders as plain text. */
export function normalizeLang(lang: string | undefined): string {
  if (!lang) return PLAIN;
  const lower = lang.toLowerCase();
  const resolved = LANG_ALIAS[lower] ?? lower;
  return (LANGS as readonly string[]).includes(resolved) ? resolved : PLAIN;
}

interface FileData {
  resolveLink?: RenderOptions['resolveLink'];
  headings?: Heading[];
}

/** Rewrites fence languages before Shiki sees them, so unknown ones never throw. */
function rehypeNormalizeCodeLang() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (node.tagName !== 'code' || (parent as Element | undefined)?.tagName !== 'pre') return;
      const classes = (node.properties.className as string[] | undefined) ?? [];
      const fence = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length);
      node.properties.className = [`language-${normalizeLang(fence)}`];
    });
  };
}

function rehypeResolveLinks() {
  return (tree: Root, file: VFile) => {
    const resolve = (file.data as FileData).resolveLink;
    if (!resolve) return;
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a' && typeof node.properties.href === 'string') {
        node.properties.href = resolve(node.properties.href);
      }
    });
  };
}

function rehypeCollectHeadings() {
  return (tree: Root, file: VFile) => {
    const headings: Heading[] = [];
    visit(tree, 'element', (node: Element) => {
      if ((node.tagName === 'h2' || node.tagName === 'h3') && typeof node.properties.id === 'string') {
        headings.push({ id: node.properties.id, text: toString(node).trim(), level: node.tagName === 'h2' ? 2 : 3 });
      }
    });
    (file.data as FileData).headings = headings;
  };
}

let processor: Processor<Root, Root, Root, Root, string> | null = null;

function getProcessor() {
  if (processor) return processor;
  processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    // No allowDangerousHtml: raw HTML in Markdown is dropped before it reaches hast.
    .use(remarkRehype)
    // GitHub schema; output is injected via dangerouslySetInnerHTML. Must run before Shiki adds inline styles.
    .use(rehypeSanitize)
    .use(rehypeNormalizeCodeLang)
    .use(rehypeResolveLinks)
    .use(rehypeSlug)
    .use(rehypeCollectHeadings)
    .use(rehypeShiki, {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      langs: [...LANGS],
      defaultLanguage: PLAIN,
      fallbackLanguage: PLAIN,
      transformers: [
        {
          pre(node) {
            node.properties['data-lang'] = this.options.lang;
          },
        },
      ],
    })
    .use(rehypeStringify) as unknown as Processor<Root, Root, Root, Root, string>;
  return processor;
}

export async function renderMarkdown(markdown: string, options: RenderOptions = {}): Promise<RenderResult> {
  const file = await getProcessor().process({ value: markdown, data: { resolveLink: options.resolveLink } });
  return { html: String(file), headings: (file.data as FileData).headings ?? [] };
}
