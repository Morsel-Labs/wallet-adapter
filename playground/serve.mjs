// Playground: a demo dApp page with the relay, Wallet Standard wallets and the Morsel extension
// stubbed (see stubs.ts), so every stage of the connect widget can be reached on demand.
//
//   npm run playground            serve on http://localhost:5178 and rebuild on change
//   node playground/serve.mjs --build      one-off build into playground/www
import * as esbuild from 'esbuild';

const port = Number(process.env.PORT || 5178);
const ctx = await esbuild.context({
  entryPoints: ['playground/main.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'playground/www/app.js',
  jsx: 'automatic',
  sourcemap: true,
  target: 'es2020',
  define: { 'process.env.NODE_ENV': '"development"', global: 'globalThis' },
  logLevel: 'info',
});

if (process.argv.includes('--build')) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
  const { port: p } = await ctx.serve({ servedir: 'playground/www', port });
  console.log(`Morsel connect playground: http://localhost:${p}/`);
}
