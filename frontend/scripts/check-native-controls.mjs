import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = fileURLToPath(new URL('../src', import.meta.url));
const primitives = path.join(source, 'components', 'ui');
const violations = [];
let checked = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (file !== primitives) await scan(file); continue; }
    if (!/\.[jt]sx?$/.test(file)) continue;
    checked++;
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/<(input|select|button)\b/g)) {
      const line = content.slice(0, match.index).split('\n').length;
      violations.push(`${path.relative(source, file)}:${line}: <${match[1]}> must use components/ui`);
    }
  }
}
await scan(source);
if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${checked} source files; native form controls are confined to components/ui.`);
