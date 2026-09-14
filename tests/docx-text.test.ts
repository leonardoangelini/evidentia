// @vitest-environment jsdom
import { zipSync, strToU8 } from 'fflate';
import { DocxParseError, extractDocxText } from '@/docx/docx-text';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function docx(bodyXml: string, stylesXml?: string): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${bodyXml}</w:body></w:document>`),
  };
  if (stylesXml) files['word/styles.xml'] = strToU8(`<?xml version="1.0"?><w:styles ${W}>${stylesXml}</w:styles>`);
  return zipSync(files);
}
const p = (text: string, pPr = '') => `<w:p>${pPr}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

describe('DOCX text extraction', () => {
  it('extracts paragraphs, joins runs, counts words', () => {
    const bytes = docx(`${p('Questo è un test')}<w:p><w:r><w:t>Titolo </w:t></w:r><w:r><w:t>testo</w:t></w:r></w:p>`);
    const ex = extractDocxText(bytes);
    expect(ex.status).toBe('FULL');
    expect(ex.paragraphs).toEqual(['Questo è un test', 'Titolo testo']);
    expect(ex.wordCount).toBe(6);
    expect(ex.text).toBe('Questo è un test\nTitolo testo');
  });
  it('detects headings by style id, localised style name and outline level', () => {
    const body =
      p('Intro', '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>') +
      p('Sezione', '<w:pPr><w:pStyle w:val="Stile7"/></w:pPr>') +
      p('Sotto', '<w:pPr><w:outlineLvl w:val="2"/></w:pPr>') +
      p('Corpo');
    const styles = '<w:style w:styleId="Stile7"><w:name w:val="Titolo 2"/></w:style>';
    const ex = extractDocxText(docx(body, styles));
    expect(ex.headings).toEqual([
      { level: 1, text: 'Intro' },
      { level: 2, text: 'Sezione' },
      { level: 3, text: 'Sotto' },
    ]);
  });
  it('skips tracked deletions, keeps insertions, handles tabs, breaks and tables', () => {
    const body =
      `<w:p><w:r><w:t>Testo</w:t></w:r><w:del><w:r><w:delText>cancellato</w:delText></w:r></w:del><w:ins><w:r><w:t xml:space="preserve"> inserito</w:t></w:r></w:ins><w:r><w:tab/><w:t>fine</w:t></w:r></w:p>` +
      `<w:tbl><w:tr><w:tc>${p('cella uno')}</w:tc><w:tc>${p('cella due')}</w:tc></w:tr></w:tbl>` +
      `<w:p><w:r><w:t>riga</w:t><w:br/><w:t>spezzata</w:t></w:r></w:p>`;
    const ex = extractDocxText(docx(body));
    expect(ex.paragraphs).toEqual(['Testo inserito fine', 'cella uno', 'cella due', 'riga spezzata']);
  });
  it('ignores empty paragraphs', () => {
    const ex = extractDocxText(docx(`<w:p/><w:p><w:r><w:t> </w:t></w:r></w:p>${p('solo')}`));
    expect(ex.paragraphs).toEqual(['solo']);
  });
  it('throws a DocxParseError on invalid input', () => {
    expect(() => extractDocxText(new Uint8Array([1, 2, 3]))).toThrow(DocxParseError);
    expect(() => extractDocxText(zipSync({ 'other.txt': strToU8('x') }))).toThrow(/document.xml/);
  });
});
