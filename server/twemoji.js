// Filnamn för Twemoji-bilder (SVG). Samma regel som Twemoji själv använder:
// utan ZWJ (U+200D) tas variantväljaren U+FE0F bort.
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname, '..', 'node_modules', '@twemoji', 'svg');

function file(emoji) {
  const raw = emoji.includes('‍') ? emoji : emoji.replace(/️/g, '');
  return [...raw].map((c) => c.codePointAt(0).toString(16)).join('-') + '.svg';
}

const exists = (emoji) => fs.existsSync(path.join(DIR, file(emoji)));

module.exports = { file, exists, DIR };
