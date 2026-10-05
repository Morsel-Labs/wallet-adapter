// Measures what a dApp actually ships when it imports the kit: bundles a tiny entry with esbuild
// (minified, React / react-dom / web3.js left external as peers) and reports JS + asset bytes.
//
//   node scripts/measure-bundle.mjs [distDir]      (default: ./dist)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readdirSync, statSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const dist = resolve(process.argv[2] ?? 'dist');
const work = mkdtempSync(join(tmpdir(), 'mw-measure-'));

const entries = {
  'full kit (provider + modal + button)': `export { WalletProvider, WalletModalProvider, WalletModal, ConnectButton } from ${JSON.stringify(join(dist, 'index.js').replace(/\\/g, '/'))};`,
  'core only (./core)': `export * from ${JSON.stringify(join(dist, 'core/index.js').replace(/\\/g, '/'))};`,
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const results = {};
for (const [label, code] of Object.entries(entries)) {
  const dir = mkdtempSync(join(work, 'e-'));
  const entry = join(dir, 'entry.mjs');
  writeFileSync(entry, code);
  const outdir = join(dir, 'out');
  await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    outdir,
    logLevel: 'silent',
    nodePaths: [resolve('node_modules')],
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', '@solana/web3.js'],
    loader: { '.png': 'file', '.ico': 'file', '.svg': 'file', '.webp': 'file' },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  let js = 0, gz = 0, br = 0, assets = 0;
  for (const f of readdirSync(outdir)) {
    const p = join(outdir, f);
    const size = statSync(p).size;
    if (f.endsWith('.js')) {
      const buf = readFileSync(p);
      js += size;
      gz += gzipSync(buf, { level: 9 }).length;
      br += brotliCompressSync(buf).length;
    } else {
      assets += size;
    }
  }
  results[label] = { js, gz, br, assets };
  console.log(`${label}\n  JS ${kb(js)} min, ${kb(gz)} gzip, ${kb(br)} brotli; image assets ${kb(assets)}; total shipped ${kb(js + assets)}`);
}
rmSync(work, { recursive: true, force: true });
if (process.env.MEASURE_JSON) writeFileSync(process.env.MEASURE_JSON, JSON.stringify(results, null, 2));
