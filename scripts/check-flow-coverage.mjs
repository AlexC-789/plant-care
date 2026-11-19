import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ID = /^[A-Z]\d+$/;

export function checkCoverage(inventoryMd, testSources) {
  const tested = new Set();
  for (const src of testSources) {
    for (const m of src.matchAll(/\btest(?:\.fail)?\(\s*(['"`])((?:[A-Z]\d+ )+)/g)) {
      m[2].trim().split(' ').forEach((id) => tested.add(id));
    }
  }
  const excused = new Set();
  const section = inventoryMd.split(/^## Not covered by e2e\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  for (const m of section.matchAll(/^- ([A-Z]\d+):/gm)) excused.add(m[1]);

  const missingP1 = [];
  const gapsOther = [];
  for (const line of inventoryMd.split('\n')) {
    if (!line.startsWith('|')) continue;
    const c = line.split('|').slice(1, -1).map((s) => s.trim());
    // shortcut: planned N* rows and section J (3 columns) are skipped by shape, not by section name
    if (c.length < 5 || !ID.test(c[0]) || c[0].startsWith('N')) continue;
    if (!/Web|Sim/.test(c[c.length - 2])) continue;
    if (tested.has(c[0]) || excused.has(c[0])) continue;
    (c[c.length - 1].startsWith('P1') ? missingP1 : gapsOther).push(c[0]);
  }
  return { missingP1, gapsOther };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../apps/mobile/e2e/', import.meta.url);
  const specs = readdirSync(dir, { recursive: true })
    .filter((f) => String(f).endsWith('.spec.ts'))
    .map((f) => readFileSync(new URL(String(f), dir), 'utf8'));
  const md = readFileSync(new URL('../docs/qa/2026-11-19-user-flows.md', import.meta.url), 'utf8');
  const { missingP1, gapsOther } = checkCoverage(md, specs);
  console.log(`P1 flows without an e2e test (${missingP1.length}): ${missingP1.join(' ') || 'none'}`);
  console.log(`Other flows without an e2e test (${gapsOther.length}): ${gapsOther.join(' ') || 'none'}`);
  process.exit(missingP1.length ? 1 : 0);
}
