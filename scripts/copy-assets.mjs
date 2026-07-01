// Cross-platform copy of the UI assets into dist (replaces the PowerShell-only step so the
// build runs on Linux CI / `npm install github:...` prepare too).
import { cpSync, mkdirSync, existsSync } from 'node:fs';

mkdirSync('dist/ui/assets', { recursive: true });
if (existsSync('src/ui/assets')) {
  cpSync('src/ui/assets', 'dist/ui/assets', { recursive: true });
}
