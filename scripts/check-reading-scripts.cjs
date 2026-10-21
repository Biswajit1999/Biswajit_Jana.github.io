/* Parse inline scripts without executing DOM-dependent code. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['index.html', 'paper-journal/index.html', ...fs.readdirSync(path.join(root,'paper-journal/papers')).map(slug=>'paper-journal/papers/'+slug+'/index.html')];
let checked = 0;
for (const file of files) {
  const html = fs.readFileSync(path.join(root,file),'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (match[1].includes('application/ld+json') || match[1].includes('src=')) continue;
    new vm.Script(match[2], {filename:file});
    checked++;
  }
}
for (const file of ['observatory-theme.js','observatory-appearance.js','orbit-playground.js','portfolio-live-count.js','portfolio-panels.js','paper-journal/paper-reader.js']) new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
console.log(JSON.stringify({pages:files.length,inlineScripts:checked,syntax:'pass'}));
