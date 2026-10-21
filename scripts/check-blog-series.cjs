/* Syntax-check executable inline scripts without running browser side effects. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'blog/series-2026/manifest.json'), 'utf8'));
let count = 0;
new vm.Script(fs.readFileSync(path.join(root,'blog/series-2026/reader.js'),'utf8'),{filename:'reader.js'});
for (const file of ['blog/index.html', ...manifest.map(p => `blog/posts/${p.slug}.html`)]) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/application\/ld\+json/.test(match[1])) { JSON.parse(match[2]); continue; }
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    new vm.Script(match[2], { filename: file }); count++;
  }
}
console.log(`Checked ${manifest.length + 1} pages; ${count} executable inline script blocks and all article JSON-LD parse.`);
