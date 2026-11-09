/**
 * The chain goes to the wallet on every signature request: the injected provider's `network`, the
 * Wallet Standard `chain` (Morsel's and every other wallet's), on sign, sign-all, sign-and-send and
 * send. A wallet that does not advertise the network is refused before anything reaches it; an
 * unknown network is refused when it is set. Every key here is generated for the test; nothing is
 * broadcast (connections are stubs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import { Keypair, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

const listeners = new Map();
globalThis.window = {
  location: { origin: 'https://dapp.test', hostname: 'dapp.test', href: 'https://dapp.test/' },
  addEventListener(type, fn) { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)).add(fn); },
  removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  dispatchEvent(event) { listeners.get(event.type)?.forEach((fn) => fn(event)); return true; },
};
globalThis.document = { title: 'Test dApp' };

const {
  MorselWalletAdapter, MorselCookieWalletAdapter, StandardWalletAdapter, svmChain,
  WalletChainNotSupportedError, WalletSendTransactionError, WalletSignTransactionError,
} = await import('../dist/core/index.js');
const { getWallets } = await import('@wallet-standard/app');

const FOGO = 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD251';
const SOLANA = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const BLOCKHASH = bs58.encode(new Uint8Array(32).fill(7));
const SIG = bs58.encode(new Uint8Array(64).fill(3));

function legacyTx(from) {
  const tx = new Transaction({ feePayer: from, recentBlockhash: BLOCKHASH });
  tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: Keypair.generate().publicKey, lamports: 1000 }));
  return tx;
}
function v0Tx(from) {
  const msg = new TransactionMessage({
    payerKey: from, recentBlockhash: BLOCKHASH,
    instructions: [SystemProgram.transfer({ fromPubkey: from, toPubkey: Keypair.generate().publicKey, lamports: 5 })],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}
const signTx = (tx, kp) => {
  if (tx instanceof VersionedTransaction) tx.sign([kp]);
  else tx.partialSign(kp);
  return tx;
};
/** Bytes in, the same transaction signed by kp out (what a Wallet Standard wallet answers). */
const signBytes = (bytes, kp) => {
  const tx = VersionedTransaction.deserialize(bytes);
  tx.sign([kp]);
  return tx.serialize();
};
/** A connection stand-in: records what would have been sent, sends nothing. */
function stubConnection() {
  const sent = [];
  return { sent, rpcEndpoint: 'stub://', sendRawTransaction: async (bytes, options) => { sent.push({ bytes, options }); return SIG; } };
}

/** An injected Morsel provider (window.morsel) that records the network of every request. */
function injectMorsel() {
  const kp = Keypair.generate();
  const calls = [];
  window.morsel = {
    isMorsel: true,
    connect: async () => ({ publicKey: kp.publicKey.toBase58() }),
    signTransaction: async (...args) => { calls.push(['signTransaction', args.length, args[1]]); return signTx(args[0], kp); },
    signAllTransactions: async (...args) => { calls.push(['signAllTransactions', args.length, args[1]]); return args[0].map((t) => signTx(t, kp)); },
    signAndSendTransaction: async (...args) => { calls.push(['signAndSendTransaction', args.length, args[1], args[2]]); return { signature: SIG }; },
  };
  return { kp, calls, remove: () => delete window.morsel };
}

test('MorselCookieWalletAdapter is MorselWalletAdapter', () => {
  assert.equal(MorselCookieWalletAdapter, MorselWalletAdapter);
  const a = new MorselCookieWalletAdapter({ chain: 'x1' });
  assert.ok(a instanceof MorselWalletAdapter);
  assert.equal(a.chain.key, 'x1');
  a.destroy();
});

test('an unknown network is refused when it is set, never taken for Solana', () => {
  assert.throws(() => new MorselWalletAdapter({ chain: 'solana:unknownchain00000000000000000000' }), /Unknown SVM network/);
  assert.throws(() => new MorselWalletAdapter({ chain: 'eip155:1' }), /Unknown SVM network/);
  const a = new MorselWalletAdapter({ chain: 'fogo' });
  assert.throws(() => a.setChain('sonic:mainnet'), /Unknown SVM network/);
  assert.equal(a.chain.key, 'fogo', 'unchanged');
  a.setChain(null);
  assert.equal(a.chain, null);
  a.destroy();
  assert.throws(() => new StandardWalletAdapter({ name: 'X', features: {} }, 'nope'), /Unknown SVM network/);
});

test('injected Morsel: sign, sign-all, sign-and-send and send all name the network', async () => {
  const { kp, calls, remove } = injectMorsel();
  try {
    const a = new MorselWalletAdapter({ chain: 'fogo' });
    a.on('error', () => {});
    await a.connect();

    const signed = await a.signTransaction(legacyTx(kp.publicKey));
    assert.equal(signed.verifySignatures(), true);
    const v = await a.signTransaction(v0Tx(kp.publicKey));
    assert.ok(v instanceof VersionedTransaction);
    await a.signAllTransactions([legacyTx(kp.publicKey), legacyTx(kp.publicKey)]);
    assert.equal(await a.signAndSendTransaction(legacyTx(kp.publicKey), { skipPreflight: true }), SIG);

    const conn = stubConnection();
    assert.equal(await a.sendTransaction(legacyTx(kp.publicKey), conn, { maxRetries: 2 }), SIG);
    assert.deepEqual(conn.sent[0].options, { maxRetries: 2 }, 'the network is not passed on to the RPC');
    assert.equal(Transaction.from(conn.sent[0].bytes).verifySignatures(), true);

    assert.deepEqual(calls, [
      ['signTransaction', 2, FOGO],
      ['signTransaction', 2, FOGO],
      ['signAllTransactions', 2, FOGO],
      ['signAndSendTransaction', 3, FOGO, { skipPreflight: true }],
      ['signTransaction', 2, FOGO],
    ]);

    // A request can name another network (Morsel Pay on Solana from a Fogo page); setChain moves them all.
    calls.length = 0;
    await a.sendTransaction(legacyTx(kp.publicKey), stubConnection(), { chain: 'solana' });
    await a.signAndSendTransaction(legacyTx(kp.publicKey), { chain: 'solayer' });
    a.setChain('solana:mainnet');
    await a.signTransaction(legacyTx(kp.publicKey));
    assert.deepEqual(calls.map((c) => c[2]), [SOLANA, 'solayer:mainnet', SOLANA]);
    await assert.rejects(a.sendTransaction(legacyTx(kp.publicKey), stubConnection(), { chain: 'nope' }), /Unknown SVM network/);
    a.destroy();
  } finally {
    remove();
  }
});

test('injected Morsel without a network set: the wallet’s own network, exactly as 0.3 called it', async () => {
  const { kp, calls, remove } = injectMorsel();
  try {
    const a = new MorselWalletAdapter();
    await a.connect();
    await a.signTransaction(legacyTx(kp.publicKey));
    await a.signAndSendTransaction(legacyTx(kp.publicKey));
    assert.deepEqual(calls, [['signTransaction', 1, undefined], ['signAndSendTransaction', 2, {}, undefined]]);
    a.destroy();
  } finally {
    remove();
  }
});

test('the 0.3 binding still holds with a network: another transaction back is refused', async () => {
  const { kp, remove } = injectMorsel();
  try {
    window.morsel.signTransaction = async () => signTx(legacyTx(kp.publicKey), kp);
    const a = new MorselWalletAdapter({ chain: 'x1' });
    a.on('error', () => {});
    await a.connect();
    await assert.rejects(a.signTransaction(legacyTx(kp.publicKey)), (e) => e instanceof WalletSignTransactionError && /does not match/.test(e.message));
    window.morsel.signAndSendTransaction = async () => ({ signature: 'not-a-signature' });
    await assert.rejects(a.signAndSendTransaction(legacyTx(kp.publicKey)), WalletSendTransactionError);
    a.destroy();
  } finally {
    remove();
  }
});

/** A Wallet Standard wallet advertising `chains`, recording the chain of every request. */
function standardWallet(name, chains, { signAndSend = true } = {}) {
  const kp = Keypair.generate();
  const account = { address: kp.publicKey.toBase58(), publicKey: kp.publicKey.toBytes(), chains, features: [] };
  const calls = [];
  const features = {
    'standard:connect': { version: '1.0.0', connect: async () => { wallet.accounts = [account]; return { accounts: [account] }; } },
    'solana:signTransaction': {
      version: '1.0.0',
      signTransaction: async (...inputs) => {
        calls.push(['sign', inputs[0].chain]);
        return inputs.map((i) => ({ signedTransaction: signBytes(i.transaction, kp) }));
      },
    },
    'solana:signMessage': { version: '1.0.0', signMessage: async () => [] },
  };
  if (signAndSend) {
    features['solana:signAndSendTransaction'] = {
      version: '1.0.0',
      signAndSendTransaction: async (...inputs) => {
        calls.push(['signAndSend', inputs[0].chain, inputs[0].options]);
        return [{ signature: new Uint8Array(64).fill(3) }];
      },
    };
  }
  const wallet = { version: '1.0.0', name, icon: 'data:image/svg+xml,x', chains, accounts: [], features };
  return { wallet, kp, calls };
}

test('another wallet: the id it advertises for the network, on sign and sign-and-send', async () => {
  const phantom = standardWallet('Phantom', ['solana:mainnet', 'solana:devnet']);
  const a = new StandardWalletAdapter(phantom.wallet, 'solana');
  assert.deepEqual(a.chains, ['solana:mainnet', 'solana:devnet']);
  await a.connect();
  await a.signTransaction(legacyTx(phantom.kp.publicKey));
  assert.equal(await a.signAndSendTransaction(legacyTx(phantom.kp.publicKey), { skipPreflight: true }), SIG);
  a.setChain('solana-devnet');
  await a.sendTransaction(legacyTx(phantom.kp.publicKey), stubConnection());
  assert.deepEqual(phantom.calls, [['sign', 'solana:mainnet'], ['signAndSend', 'solana:mainnet', { skipPreflight: true }], ['sign', 'solana:devnet']]);

  const backpack = standardWallet('Backpack', ['solana:CDLtwKnaCoK157uaHQDj4fHu72AyD2519', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpK']);
  const b = new StandardWalletAdapter(backpack.wallet, svmChain('fogo'));
  await b.connect();
  await b.signTransaction(v0Tx(backpack.kp.publicKey));
  assert.deepEqual(backpack.calls, [['sign', 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD2519']]);
});

test('another wallet on a network it does not advertise is refused before anything reaches it', async () => {
  const phantom = standardWallet('Phantom', ['solana:mainnet', 'solana:devnet']);
  const a = new StandardWalletAdapter(phantom.wallet, 'fogo');
  const errors = [];
  a.on('error', (e) => errors.push(e));
  await a.connect();
  await assert.rejects(a.signTransaction(legacyTx(phantom.kp.publicKey)), (e) => e instanceof WalletChainNotSupportedError && e.message === 'Phantom does not support Fogo');
  await assert.rejects(a.signAndSendTransaction(legacyTx(phantom.kp.publicKey)), WalletChainNotSupportedError);
  await assert.rejects(a.sendTransaction(legacyTx(phantom.kp.publicKey), stubConnection()), WalletChainNotSupportedError);
  a.setChain('solayer');
  await assert.rejects(a.signTransaction(legacyTx(phantom.kp.publicKey)), /does not support Solayer/);
  assert.deepEqual(phantom.calls, [], 'the wallet was never asked');
  assert.equal(errors.length, 4);
});

test('another wallet without sign-and-send and no network set refuses to guess where to send', async () => {
  const w = standardWallet('Glow', ['solana:mainnet'], { signAndSend: false });
  const a = new StandardWalletAdapter(w.wallet);
  a.on('error', () => {});
  await a.connect();
  await assert.rejects(a.signAndSendTransaction(legacyTx(w.kp.publicKey)), (e) => e instanceof WalletSendTransactionError && /No network/.test(e.message));
  // Without a network, signing keeps 0.3's choice: the account's first chain.
  await a.signTransaction(legacyTx(w.kp.publicKey));
  assert.deepEqual(w.calls, [['sign', 'solana:mainnet']]);
});

test('Morsel registered only through the Wallet Standard gets the network too', async () => {
  const morsel = standardWallet('Morsel', [SOLANA, FOGO, 'solayer:mainnet', 'solana:mainnet']);
  const unregister = getWallets().register(morsel.wallet);
  try {
    const a = new MorselWalletAdapter({ chain: 'solayer' });
    assert.equal(a.readyState, 'Installed');
    await a.connect();
    await a.signTransaction(legacyTx(morsel.kp.publicKey));
    assert.equal(await a.signAndSendTransaction(legacyTx(morsel.kp.publicKey), { maxRetries: 1 }), SIG);
    a.setChain('fogo');
    await a.signAllTransactions([legacyTx(morsel.kp.publicKey)]);
    assert.deepEqual(morsel.calls, [['sign', 'solayer:mainnet'], ['signAndSend', 'solayer:mainnet', { maxRetries: 1 }], ['sign', FOGO]]);
    a.destroy();
  } finally {
    unregister();
  }
});
