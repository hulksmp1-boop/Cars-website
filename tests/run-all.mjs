/** Run:  node tests/run-all.mjs   (runs every *.test.mjs in this folder) */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort()) {
  console.log(`\n=== ${file}`);
  const result = spawnSync(process.execPath, [join(dir, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) FAILED` : '\nAll test files passed');
process.exit(failed ? 1 : 0);
