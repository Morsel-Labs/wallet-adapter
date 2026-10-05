import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COOKIE_CHAIN,
  MORSEL_COOKIE_WALLET_ICON,
  MORSEL_RELAY_PAIRING_TTL_MS,
  morselBrowseLink,
  detectMorselCookieProvider,
  detectStandardMorselProvider,
  MorselCookieWalletAdapter,
} from '../dist/core/index.js';
import { toBase64, fromBase64, toBase64Url } from '../dist/core/base64.js';

test('Cookie Chain descriptor points at the real hosts', () => {
  assert.equal(COOKIE_CHAIN.symbol, 'COOK');
  assert.equal(COOKIE_CHAIN.rpcUrl, 'https://rpc.cookiescan.io');
  assert.equal(COOKIE_CHAIN.explorerUrl, 'https://cookiescan.io');
});

test('wallet icon is the real Morsel mark, not a placeholder', () => {
  assert.match(MORSEL_COOKIE_WALLET_ICON, /^data:image\/webp;base64,/);
  assert.ok(MORSEL_COOKIE_WALLET_ICON.length > 2000);
});

test('browse link opens the page inside Morsel', () => {
  assert.equal(
    morselBrowseLink('https://swap.example/trade?x=1'),
    'https://morselwallet.app/ul/browse/https%3A%2F%2Fswap.example%2Ftrade%3Fx%3D1?ref=https%3A%2F%2Fswap.example'
  );
  assert.equal(MORSEL_RELAY_PAIRING_TTL_MS, 300000);
});

test('base64 helpers round-trip without Buffer', () => {
  const bytes = new Uint8Array(70000).map((_, i) => (i * 7) & 255);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  const url = toBase64Url(new Uint8Array([251, 255, 254]));
  assert.equal(url, '-__-');
  assert.deepEqual(fromBase64(url), new Uint8Array([251, 255, 254]));
});

test('server side: no window, no provider, no timers, no relay', () => {
  assert.equal(detectMorselCookieProvider(), null);
  assert.equal(detectStandardMorselProvider(), null);
  const a = new MorselCookieWalletAdapter();
  assert.equal(a.readyState, 'Unsupported');
  assert.equal(a.relayStatus, 'idle');
  assert.equal(a.wcUri, '');
  a.restartRelaySession(); // no-op on the server
  assert.equal(a.wcUri, '');
  a.destroy();
});
