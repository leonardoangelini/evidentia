/**
 * Writes the export of every demo case to .output/demo-exports/<case>/,
 * unzipped, so report and LLM files can be inspected without a browser.
 *
 *   npm run demo:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEMO_CASES } from '../src/demo/cases';
import { buildExportFiles, zipFiles } from '../src/export/exporter';
import { DEFAULT_SETTINGS } from '../src/models';

const outRoot = join(process.cwd(), '.output', 'demo-exports');

for (const demo of DEMO_CASES) {
  const dataset = await demo.build();
  const { files } = await buildExportFiles(dataset, DEFAULT_SETTINGS, 'demo');
  const dir = join(outRoot, `case-${demo.id}`);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  writeFileSync(join(outRoot, `evidentia-export-case-${demo.id}.zip`), zipFiles(files));
  const compact = files['llm/analysis-input-compact.json']?.length ?? 0;
  console.log(`case ${demo.id}: ${dataset.events.length} events, ${dataset.snapshots.length} snapshots, compact LLM input ${Math.round(compact / 1024)} KB → ${dir}`);
}
