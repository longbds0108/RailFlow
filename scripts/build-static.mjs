import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Only public site assets are copied. Environment files never enter the output.
const files = ['index.html', 'trade.html', 'css/styles.css', 'css/trade.css', 'js/main.js', 'js/trade.js'];
for (const file of files) {
  const source = await readFile(resolve(root, file), 'utf8');
  if (file.endsWith('.js')) new Script(source, { filename: file });
  if (file.endsWith('.html')) {
    for (const match of source.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      const reference = match[1].split('#')[0];
      if (/^https?:\/\//.test(reference)) continue;
      if (!files.includes(reference)) throw new Error(`Missing public asset: ${file} → ${reference}`);
    }
  }
  const destination = resolve(root, 'dist', file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, file), destination);
}
console.log('Validated and prepared 2 pages and 4 CSS/JavaScript assets in dist/.');
