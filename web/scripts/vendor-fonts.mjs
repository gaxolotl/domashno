// One-off: vendor Golos Text woff2 subsets locally (was: Google Fonts CDN).
// Run from domashno/web. Reads $env:TEMP/golos.css, writes public/fonts/* + src/fonts.css.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const css = fs.readFileSync(path.join(process.env.TEMP, 'golos.css'), 'utf8');
const outDir = path.resolve('public/fonts');
fs.mkdirSync(outDir, { recursive: true });

const blocks = [...css.matchAll(/\/\* (\S+) \*\/\s*@font-face \{([^}]+)\}/g)];
const urlToFile = new Map();
let cssOut = '';
for (const [, subset, body] of blocks) {
  const weight = body.match(/font-weight:\s*(\d+)/)[1];
  const url = body.match(/url\((https:[^)]+)\)/)[1];
  const range = body.match(/unicode-range:\s*([^;]+);/)[1].trim();
  let file = urlToFile.get(url);
  if (!file) {
    file = `golos-text-${subset}-${weight}.woff2`;
    urlToFile.set(url, file);
    execFileSync('curl.exe', ['-sL', url, '-o', path.join(outDir, file)], { stdio: 'inherit' });
    const bytes = fs.statSync(path.join(outDir, file)).size;
    console.log(`${file}  ${(bytes / 1024).toFixed(1)} KiB`);
  }
  cssOut += `/* ${subset} — ${weight} */\n@font-face {\n  font-family: 'Golos Text';\n  font-style: normal;\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${file}') format('woff2');\n  unicode-range: ${range};\n}\n`;
}
fs.writeFileSync('src/fonts.css', cssOut);
console.log(`\nwrote src/fonts.css, ${urlToFile.size} files`);
