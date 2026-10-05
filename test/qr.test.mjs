import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { encodeQr } from '../dist/ui/kit/qr.js';

// The kit ships its own byte-mode QR encoder; the `qrcode` package (dev only) is the reference.
function rand(len, seed) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_%:/.?=&';
  let x = seed;
  let s = '';
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += alphabet[x % alphabet.length];
  }
  return s;
}

test('matches the reference encoder bit for bit (all ECC levels, all masks, v1 to v40)', () => {
  let checked = 0;
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    for (const len of [1, 14, 40, 128, 400, 1200]) {
      for (let mask = 0; mask < 8; mask++) {
        const text = len === 40 ? `héllo ✓ ${rand(len, mask + 7)}` : rand(len, len * 31 + mask);
        let ref;
        try {
          ref = QRCode.create([{ data: text, mode: 'byte' }], { errorCorrectionLevel: ecc, maskPattern: mask });
        } catch {
          continue; // too long for this ECC level
        }
        const mine = encodeQr(text, ecc, mask);
        const n = ref.modules.size;
        assert.equal(mine.length, n, `size ${ecc} len ${len}`);
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) assert.equal(mine[y][x], !!ref.modules.get(y, x), `module ${x},${y} (${ecc}, len ${len}, mask ${mask})`);
        }
        checked++;
      }
    }
  }
  assert.ok(checked > 150, `checked ${checked}`);
});

test('a real pairing URI fits a small, scannable version', () => {
  const uri =
    'morsel://connect?s=' + rand(32, 1) + '&k=' + rand(43, 2) + '&r=' + encodeURIComponent('wss://api.dumpsack.xyz');
  const m = encodeQr(uri, 'Q');
  const version = (m.length - 17) / 4;
  assert.ok(version <= 10, `version ${version}`);
});

test('rejects data that cannot fit', () => {
  assert.throws(() => encodeQr('x'.repeat(4000), 'H'), RangeError);
});
