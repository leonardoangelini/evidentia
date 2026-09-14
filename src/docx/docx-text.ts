/**
 * Extract paragraph text and headings from a DOCX (OOXML) file.
 *
 * Only the main body (word/document.xml) is read: headers, footers,
 * footnotes and comments are not part of the text being analysed.
 * Tracked deletions (<w:del>) are excluded; tracked insertions (<w:ins>) are
 * included, matching what Word shows with "All markup".
 *
 * Uses DOMParser, available in extension pages and in jsdom for tests.
 */
import { unzipSync } from 'fflate';
import type { ExtractedDocument, Heading } from '@/models';
import { countWords, normalizeLine, normalizeText } from '@/utils/text';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const HEADING_STYLE = /^(heading|titolo|t[ií]tulo|titre|[uü]berschrift|kop|rubrik|overskrift)\s?(\d)$/i;

export interface DocxParseOptions {
  /** Injectable for environments without a global DOMParser. */
  parser?: DOMParser;
}

export class DocxParseError extends Error {}

export function extractDocxText(bytes: Uint8Array, options: DocxParseOptions = {}): ExtractedDocument {
  const notes: string[] = [];
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    throw new DocxParseError(`Not a valid DOCX/ZIP archive: ${String(e)}`);
  }
  const documentXml = files['word/document.xml'];
  if (!documentXml) throw new DocxParseError('word/document.xml not found in archive');
  const xml = new TextDecoder('utf-8').decode(documentXml);
  const parser = options.parser ?? new DOMParser();
  const dom = parser.parseFromString(xml, 'application/xml');
  const parseError = dom.getElementsByTagName('parsererror')[0];
  if (parseError) throw new DocxParseError(`Malformed document.xml: ${parseError.textContent?.slice(0, 120) ?? ''}`);

  const body = dom.getElementsByTagNameNS(W_NS, 'body')[0] ?? dom.documentElement;
  const styleNames = readStyleNames(files['word/styles.xml'], parser);
  const paragraphs: string[] = [];
  const headings: Heading[] = [];

  for (const p of Array.from(body.getElementsByTagNameNS(W_NS, 'p'))) {
    const text = normalizeLine(paragraphText(p));
    if (text.length === 0) continue;
    paragraphs.push(text);
    const level = headingLevel(p, styleNames);
    if (level !== null) headings.push({ level, text });
  }

  const text = normalizeText(paragraphs.join('\n'));
  if (paragraphs.length === 0) notes.push('document.xml contains no paragraph text');
  return {
    status: 'FULL',
    text,
    paragraphs,
    headings,
    wordCount: countWords(text),
    characterCount: text.length,
    notes,
  };
}

/** Concatenate the visible runs of a paragraph, skipping tracked deletions. */
function paragraphText(p: Element): string {
  let out = '';
  const walk = (node: Node): void => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.namespaceURI !== W_NS) {
      for (const c of Array.from(el.childNodes)) walk(c);
      return;
    }
    switch (el.localName) {
      case 'del':
      case 'moveFrom':
      case 'delText':
        return; // tracked deletion: not part of the current text
      case 't':
        out += el.textContent ?? '';
        return;
      case 'tab':
        out += ' ';
        return;
      case 'br':
      case 'cr':
        out += ' ';
        return;
      case 'sym':
        out += ' ';
        return;
      case 'noBreakHyphen':
        out += '-';
        return;
      case 'softHyphen':
        return;
      case 'p':
        if (el !== p) {
          // Nested paragraph (e.g. inside a text box): keep its text inline.
          for (const c of Array.from(el.childNodes)) walk(c);
          out += ' ';
          return;
        }
        break;
      default:
        break;
    }
    for (const c of Array.from(el.childNodes)) walk(c);
  };
  walk(p);
  return out;
}

function headingLevel(p: Element, styleNames: Map<string, string>): number | null {
  const pPr = firstChildNS(p, 'pPr');
  if (!pPr) return null;
  const style = firstChildNS(pPr, 'pStyle');
  const styleId = style?.getAttributeNS(W_NS, 'val') ?? style?.getAttribute('w:val') ?? null;
  if (styleId) {
    const m = HEADING_STYLE.exec(styleId) ?? HEADING_STYLE.exec(styleNames.get(styleId) ?? '');
    if (m && m[2]) return Number.parseInt(m[2], 10);
  }
  const outline = firstChildNS(pPr, 'outlineLvl');
  const lvl = outline?.getAttributeNS(W_NS, 'val') ?? outline?.getAttribute('w:val') ?? null;
  if (lvl !== null) {
    const n = Number.parseInt(lvl, 10);
    if (Number.isFinite(n) && n < 9) return n + 1;
  }
  return null;
}

/** styleId → style name, so localised names ("Titolo 1") map to heading levels. */
function readStyleNames(stylesXml: Uint8Array | undefined, parser: DOMParser): Map<string, string> {
  const map = new Map<string, string>();
  if (!stylesXml) return map;
  try {
    const dom = parser.parseFromString(new TextDecoder('utf-8').decode(stylesXml), 'application/xml');
    for (const style of Array.from(dom.getElementsByTagNameNS(W_NS, 'style'))) {
      const id = style.getAttributeNS(W_NS, 'styleId') ?? style.getAttribute('w:styleId');
      const name = firstChildNS(style, 'name');
      const val = name?.getAttributeNS(W_NS, 'val') ?? name?.getAttribute('w:val');
      if (id && val) map.set(id, val);
    }
  } catch {
    // styles are optional for extraction
  }
  return map;
}

function firstChildNS(el: Element, localName: string): Element | null {
  for (const c of Array.from(el.children)) if (c.namespaceURI === W_NS && c.localName === localName) return c;
  return null;
}
