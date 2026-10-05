import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSpring, spring } from '../dist/ui/kit/motion.js';
import { shortAddress, isUserRejection, friendlyError, formatBalance, avatarBackground, isMorselAdapterName, displayWalletName } from '../dist/ui/kit/env.js';
import { getMorselConnectCss } from '../dist/ui/kit/styles.js';

test('springs sample into a linear() easing from 0 to 1', () => {
  const s = sampleSpring(520, 42);
  assert.match(s.easing, /^linear\(0, /);
  assert.match(s.easing, /, 1\)$/);
  assert.ok(s.duration > 150 && s.duration < 1500, `duration ${s.duration}`);
  const bouncy = spring('bouncy');
  const peak = Math.max(...bouncy.easing.slice(7, -1).split(', ').map(Number));
  assert.ok(peak > 1.02, 'bouncy overshoots');
  const snappy = spring('snappy');
  const peak2 = Math.max(...snappy.easing.slice(7, -1).split(', ').map(Number));
  assert.ok(peak2 < 1.03, 'snappy barely overshoots');
});

test('address, error and balance helpers', () => {
  assert.equal(shortAddress('9fe3iQhJm2xkCqv1p8mP5d1nWqKUZ1xYyAUSJU'), '9fe3…USJU');
  assert.equal(shortAddress('short'), 'short');
  assert.ok(isUserRejection({ code: 4001 }));
  assert.ok(isUserRejection(new Error('User rejected the request.')));
  assert.ok(!isUserRejection(new Error('Network down')));
  assert.equal(friendlyError(new Error('Unknown error')), undefined);
  assert.equal(friendlyError(new Error('x'.repeat(300))).length, 120);
  assert.equal(formatBalance(1284.5675), '1,285');
  assert.equal(formatBalance(12.48231), '12.48');
  assert.equal(formatBalance(0.001234), '0.0012');
  assert.equal(formatBalance(2500000), '2.5M');
  assert.equal(avatarBackground('abc'), avatarBackground('abc'));
  assert.notEqual(avatarBackground('abc'), avatarBackground('abd'));
  assert.ok(isMorselAdapterName('Morsel Cookie Wallet'));
  assert.equal(displayWalletName('Morsel Cookie Wallet'), 'Morsel');
});

test('every stylesheet rule is scoped to the kit (no leaks into the host)', () => {
  const css = getMorselConnectCss();
  assert.ok(!css.includes('/*'), 'no comments shipped');
  const noKeyframes = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const selectors = (noKeyframes.match(/(^|})\s*[^{}@]+(?=\{)/g) ?? []).map((s) => s.replace(/^}\s*/, '').trim());
  const split = (s) => {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const all = selectors.flatMap(split).filter(Boolean);
  assert.ok(all.length > 100, `parsed ${all.length} selectors`);
  const bad = all.filter((s) => !s.startsWith('.mw-'));
  assert.deepEqual(bad, []);
  // every keyframe is namespaced too
  for (const k of css.match(/@keyframes\s+([\w-]+)/g) ?? []) assert.match(k, /@keyframes mw-/);
});
