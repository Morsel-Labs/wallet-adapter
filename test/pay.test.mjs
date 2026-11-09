import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { morselPay, checkoutIdOf, morselCheckoutUrl, payRpcUrl, payChainOf, MorselPayError } from '../dist/core/index.js';

const ID = 'cs_AbCdEf123456789012345678';
const payer = Keypair.generate();
const merchant = Keypair.generate().publicKey;

const checkout = (over = {}) => ({
  id: ID, status: 'open', livemode: true, network: 'solana', token: 'USDC', mint: 'x', amount: '30', description: 'Gold',
  merchant: { name: 'Shop', logo_url: null, website: null }, success_url: null, cancel_url: null, signature: null,
  expires_at: new Date(Date.now() + 600_000).toISOString(), solana_pay: 'solana:x', ...over,
});
const unsignedTx = () => {
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1 });
  tx.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: merchant, lamports: 1 }));
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
};

/** A pretend Morsel Pay API: `states` is what successive GETs answer. */
function api(states) {
  const calls = [];
  let i = 0;
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (url.endsWith('/solana-pay')) return json(200, { transaction: unsignedTx(), message: 'Pay 30 USDC' });
    const s = states[Math.min(i, states.length - 1)];
    i += 1;
    return s === 404 ? json(404, {}) : json(200, s);
  };
  return { fetch, calls };
}

test('reads a checkout id from an id or its URL', () => {
  assert.equal(checkoutIdOf(ID), ID);
  assert.equal(checkoutIdOf(`https://morselwallet.app/checkout/${ID}?x=1`), ID);
  assert.equal(checkoutIdOf('nope'), null);
  assert.equal(morselCheckoutUrl(ID), `https://morselwallet.app/checkout/${ID}`);
  assert.equal(payRpcUrl({ network: 'cookie', livemode: true }), 'https://rpc.cookiescan.io');
  assert.equal(payRpcUrl({ network: 'solana', livemode: false }), 'https://api.devnet.solana.com');
});

test('a checkout’s network comes from SVM_CHAINS; one it does not know is refused, never paid on Solana', () => {
  assert.equal(payChainOf({ network: 'solana', livemode: true }).id, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
  assert.equal(payChainOf({ network: 'solana', livemode: false }).key, 'solana-devnet');
  assert.equal(payChainOf({ network: 'cookie', livemode: false }).key, 'cookie', 'Cookie Chain test checkouts settle on Cookie Chain, as before');
  assert.equal(payRpcUrl({ network: 'fogo', livemode: true }), 'https://mainnet.fogo.io');
  for (const network of ['eclipse', 'solana:unknownchain00000000000000000000', '', undefined]) {
    assert.throws(() => payRpcUrl({ network, livemode: true }), (e) => e instanceof MorselPayError && e.code === 'network');
  }
});

test('the wallet is asked to sign for the checkout’s network, whatever network the page is on', async () => {
  const { fetch } = api([checkout({ network: 'cookie' }), checkout({ network: 'cookie', status: 'paid', signature: 's' })]);
  let seen = null;
  const wallet = { publicKey: payer.publicKey, connected: true, sendTransaction: async (tx, connection, options) => { seen = { endpoint: connection.rpcEndpoint, options }; return 's'; } };
  await morselPay({ checkout: ID, wallet, fetch, pollMs: 500 });
  assert.deepEqual(seen, { endpoint: 'https://rpc.cookiescan.io', options: { skipPreflight: false, chain: 'solana:9wDaBRDgArEUpvhHxGguNkwozsZh4UpG' } });
  await assert.rejects(
    morselPay({ checkout: ID, wallet, fetch: api([checkout({ network: 'eclipse' })]).fetch }),
    (e) => e instanceof MorselPayError && e.code === 'network' && /does not know/.test(e.message)
  );
});

test('a connected wallet pays in the page; resolves only once the API says paid', async () => {
  const { fetch, calls } = api([checkout(), checkout(), checkout({ status: 'paid', signature: 'sig1' })]);
  const seen = [];
  let sent = null;
  const wallet = { publicKey: payer.publicKey, connected: true, sendTransaction: async (tx) => { sent = tx; return 'sig1'; } };
  const r = await morselPay({ checkout: ID, wallet, fetch, pollMs: 500, onStatus: (s) => seen.push(s) });
  assert.deepEqual(r, { id: ID, status: 'paid', signature: 'sig1', network: 'solana', token: 'USDC', amount: '30', via: 'wallet' });
  assert.deepEqual(seen, ['loading', 'signing', 'confirming', 'paid']);
  assert.ok(sent instanceof Transaction);
  const post = calls.find((c) => c.method === 'POST');
  assert.deepEqual(JSON.parse(post.body), { account: payer.publicKey.toBase58() });
});

test('the wallet saying no is "rejected"; an expired checkout is "expired"; an unknown one "not_found"', async () => {
  const wallet = { publicKey: payer.publicKey, connected: true, sendTransaction: async () => { throw new Error('User rejected the request.'); } };
  await assert.rejects(morselPay({ checkout: ID, wallet, fetch: api([checkout()]).fetch }), (e) => e instanceof MorselPayError && e.code === 'rejected');
  await assert.rejects(morselPay({ checkout: ID, fetch: api([checkout({ status: 'expired' })]).fetch }), (e) => e.code === 'expired');
  await assert.rejects(morselPay({ checkout: ID, fetch: api([404]).fetch }), (e) => e.code === 'not_found');
});

test('already paid resolves at once, and stopping it rejects "aborted"', async () => {
  const r = await morselPay({ checkout: ID, fetch: api([checkout({ status: 'paid', signature: 's' })]).fetch });
  assert.equal(r.status, 'paid');
  const ac = new AbortController();
  const wallet = { publicKey: payer.publicKey, connected: true, sendTransaction: async () => 'sig' };
  const p = morselPay({ checkout: ID, wallet, fetch: api([checkout()]).fetch, pollMs: 500, signal: ac.signal });
  setTimeout(() => ac.abort(), 50);
  await assert.rejects(p, (e) => e.code === 'aborted');
});

test('the hosted checkout opens in a popup without a wallet, and closes when paid', async () => {
  let opened = null;
  const popup = { closed: false, close() { this.closed = true; } };
  globalThis.window = { open: (url) => { opened = url; return popup; }, screenX: 0, screenY: 0, outerWidth: 1200, outerHeight: 900, location: { assign() {} } };
  try {
    const r = await morselPay({ checkout: ID, fetch: api([checkout(), checkout({ status: 'paid', signature: 's2' })]).fetch, pollMs: 500 });
    assert.equal(opened, `https://morselwallet.app/checkout/${ID}`);
    assert.equal(r.via, 'page');
    assert.equal(popup.closed, true);
  } finally { delete globalThis.window; }
});
