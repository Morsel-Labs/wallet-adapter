// tsc (moduleResolution: Bundler) emits extensionless relative imports, which Node ESM rejects.
// Rewrite them to explicit .js (or /index.js for directory imports) so the published package resolves
// under Node ESM AND bundlers. Runs over dist/**/*.{js,d.ts}.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

function resolveSpec(fileDir, spec) {
  if (/\.(js|json|css|svg|png|ico)$/.test(spec)) return spec;
  const base = join(fileDir, spec);
  if (existsSync(`${base}.js`)) return `${spec}.js`;
  if (existsSync(join(base, 'index.js'))) return `${spec}/index.js`;
  return `${spec}.js`;
}

function fixFile(path) {
  const dir = dirname(path);
  let src = readFileSync(path, 'utf8');
  // static: from '...' / import '...' / export ... from '...'
  src = src.replace(/(\bfrom\s*['"])(\.\.?\/[^'"]+?)(['"])/g, (_m, a, spec, b) => a + resolveSpec(dir, spec) + b);
  // dynamic import('...')
  src = src.replace(/(\bimport\s*\(\s*['"])(\.\.?\/[^'"]+?)(['"]\s*\))/g, (_m, a, spec, b) => a + resolveSpec(dir, spec) + b);
  writeFileSync(path, src);
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.js$/.test(name) || /\.d\.ts$/.test(name)) fixFile(p);
  }
}

if (existsSync('dist')) walk('dist');
