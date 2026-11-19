import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage } from './check-flow-coverage.mjs';

const inv = (...rows) => `## D. Add\n\n| ID | Flow | Branches | Where | P |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
const row = (id, where = 'Web', p = 'P1') => `| ${id} | f | b | ${where} | ${p} |`;
const t = (title) => `test('${title}', async () => {});`;

test('untested P1 Web row is missing', () => {
  assert.deepEqual(checkCoverage(inv(row('D9')), []).missingP1, ['D9']);
});
test('title with leading ID covers it', () => {
  assert.deepEqual(checkCoverage(inv(row('D9')), [t('D9 @pr cancel')]).missingP1, []);
});
test('one title covers several IDs', () => {
  const r = checkCoverage(inv(row('D9'), row('D10')), [t('D9 D10 both')]);
  assert.deepEqual(r.missingP1, []);
});
test('test.fail titles count', () => {
  assert.deepEqual(checkCoverage(inv(row('D9')), ["test.fail('D9 x', () => {});"]).missingP1, []);
});
test('excused ID is not missing', () => {
  const md = inv(row('F6', 'Sim')) + '\n## Not covered by e2e\n\n- F6: fn:test + sim:test\n';
  assert.deepEqual(checkCoverage(md, []).missingP1, []);
});
test('N rows are ignored', () => {
  assert.deepEqual(checkCoverage(inv(row('N3')), []), { missingP1: [], gapsOther: [] });
});
test('P2 untested goes to gapsOther', () => {
  assert.deepEqual(checkCoverage(inv(row('D9', 'Web', 'P2')), []), { missingP1: [], gapsOther: ['D9'] });
});
test('Native-only rows are ignored', () => {
  assert.deepEqual(checkCoverage(inv(row('D3', 'Native')), []), { missingP1: [], gapsOther: [] });
});
test('"P1 (grant)" counts as P1', () => {
  assert.deepEqual(checkCoverage(inv(row('I3', 'Web', 'P1 (grant)')), []).missingP1, ['I3']);
});
test('section J rows (no P column) are ignored', () => {
  const md = '| ID | Check | Where |\n|---|---|---|\n| J1 | Light | Web |\n';
  assert.deepEqual(checkCoverage(md, []), { missingP1: [], gapsOther: [] });
});
