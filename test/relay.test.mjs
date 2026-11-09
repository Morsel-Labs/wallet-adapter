/**
 * The relay side of the Morsel adapter, driven through a fake WebSocket and a fake phone that speaks the
 * real protocol: lazy start/stop of the relay (nothing before the QR is asked for), the wallet's signed
 * approve proof (valid accepted; missing, forged or replayed refused; a second hello ignored), and the
 * binding of every signing result to its request (a different transaction or a signature that does not
 * verify is refused).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

// ---- a page, as far as the adapter can tell --------------------------------------------------------
globalThis.window = {
  location: { origin: 'https://dapp.test', hostname: 'dapp.test', href: 'https://dapp.test/' },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
};
globalThis.document = { title: 'Test dApp' };

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.sent = [];
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }
  receive(msg) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}
globalThis.WebSocket = FakeWebSocket;
const lastSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

// The adapter reads `window` at import time, so import after the stubs are in place.
const { MorselCookieWalletAdapter, WalletNotFoundError, WalletSignTransactionError, WalletSignMessageError, approveProofPayload, verifyApproveProof, relayPeerFingerprint } =
  await import('../dist/core/index.js');
const { toBase64, fromBase64, toBase64Url } = await import('../dist/core/base64.js');

const OFFCHAIN = new Uint8Array([0xff, ...new TextEncoder().encode('solana offchain')]);
const tick = () => new Promise((r) => setImmediate(r));

/** The phone: a box key pair for the channel and an ed25519 key pair for the account it connects. */
class Phone {
  constructor(uri, signKp = nacl.sign.keyPair()) {
    const q = new URL(uri.replace('morsel://', 'https://x/')).searchParams;
    this.sessionId = q.get('s');
    this.dappPub = fromBase64(q.get('k'));
    this.box = nacl.box.keyPair();
    this.sign = signKp;
    this.address = bs58.encode(signKp.publicKey);
  }
  hello(ws) {
    ws.receive({ type: 'peer_joined', role: 'wallet' });
    ws.receive({ type: 'wallet_hello', pubkey: toBase64Url(this.box.publicKey) });
  }
  /** Every message the dApp has sent that this phone can open. */
  inbox(ws) {
    return ws.sent
      .filter((m) => m.type === 'enc')
      .map((m) => {
        const all = fromBase64(m.payload);
        const out = nacl.box.open(all.slice(24), all.slice(0, 24), this.dappPub, this.box.secretKey);
        return out ? JSON.parse(new TextDecoder().decode(out)) : null;
      })
      .filter(Boolean);
  }
  proposalId(ws) { return this.inbox(ws).find((m) => m.type === 'session_proposal')?.id ?? null; }
  payload(over = {}) {
    return approveProofPayload({
      sessionId: this.sessionId,
      dappX25519Pub: this.dappPub,
      walletX25519Pub: this.box.publicKey,
      walletAddress: this.sign.publicKey,
      ...over,
    });
  }
  signature(payload = this.payload(), key = this.sign.secretKey) {
    return bs58.encode(nacl.sign.detached(payload, key));
  }
  approve(ws, extra = {}) {
    this.send(ws, { type: 'session_approve', id: this.proposalId(ws), walletAddress: this.address, signature: this.signature(), ...extra });
  }
  send(ws, msg) {
    const nonce = nacl.randomBytes(24);
    const box = nacl.box(new TextEncoder().encode(JSON.stringify(msg)), nonce, this.dappPub, this.box.secretKey);
    const all = new Uint8Array(24 + box.length);
    all.set(nonce);
    all.set(box, 24);
    ws.receive({ type: 'enc', payload: toBase64(all) });
  }
}

/** A fresh adapter with a live QR, the phone that scanned it, and the socket between them. */
function pair() {
  const adapter = new MorselCookieWalletAdapter();
  const errors = [];
  adapter.on('error', (e) => errors.push(e));
  adapter.startRelaySession();
  const ws = lastSocket();
  const phone = new Phone(adapter.wcUri);
  phone.hello(ws);
  return { adapter, ws, phone, errors };
}

function connectedPair() {
  const p = pair();
  p.phone.approve(p.ws);
  assert.equal(p.adapter.connected, true, 'paired');
  return p;
}

const BLOCKHASH = bs58.encode(new Uint8Array(32).fill(7));
function legacyTx(from, lamports = 1000) {
  const tx = new Transaction({ feePayer: from, recentBlockhash: BLOCKHASH });
  tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: Keypair.generate().publicKey, lamports }));
  return tx;
}
function v0Tx(from, lamports = 1000) {
  const msg = new TransactionMessage({
    payerKey: from,
    recentBlockhash: BLOCKHASH,
    instructions: [SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(new Uint8Array(32).fill(9)), lamports })],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}
const wire = (tx) => (tx instanceof VersionedTransaction ? tx.serialize() : new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false })));

/** Answer the one pending sign request on `ws` with `result`. */
function answer(phone, ws, result) {
  const req = phone.inbox(ws).filter((m) => m.type === 'sign_transaction' || m.type === 'sign_message').pop();
  assert.ok(req, 'a sign request reached the phone');
  phone.send(ws, { type: 'sign_result', id: req.id, ...result });
  return req;
}

// ---- lazy relay ------------------------------------------------------------------------------------

test('constructing the adapter contacts no relay; the QR view starts it and stops it', () => {
  const before = FakeWebSocket.instances.length;
  const adapter = new MorselCookieWalletAdapter();
  assert.equal(FakeWebSocket.instances.length, before, 'no socket from the constructor');
  assert.equal(adapter.wcUri, '');
  assert.equal(adapter.relayStatus, 'idle');

  const uris = [];
  adapter.on('wcUriChange', (u) => uris.push(u));
  adapter.startRelaySession();
  assert.equal(FakeWebSocket.instances.length, before + 1);
  assert.match(adapter.wcUri, /^morsel:\/\/connect\?s=[A-Za-z0-9]{32}&k=[A-Za-z0-9_-]{43}&r=wss%3A%2F%2Fapi\.dumpsack\.xyz$/);
  assert.match(lastSocket().url, /^wss:\/\/api\.dumpsack\.xyz\/relay\/[A-Za-z0-9]{32}\?role=dapp$/);
  assert.equal(adapter.relayStatus, 'waiting');
  adapter.startRelaySession();
  assert.equal(FakeWebSocket.instances.length, before + 1, 'starting twice keeps the live session');

  adapter.stopRelaySession();
  assert.equal(lastSocket().readyState, 3, 'socket closed');
  assert.equal(adapter.wcUri, '');
  assert.equal(adapter.relayStatus, 'idle');
  assert.deepEqual(uris.slice(-1), ['']);
  adapter.destroy();
});

test('connect() with no Morsel on the page opens the relay (so the QR is ready) and reports not found', async () => {
  const adapter = new MorselCookieWalletAdapter();
  adapter.on('error', () => {});
  await assert.rejects(adapter.connect(), WalletNotFoundError);
  assert.notEqual(adapter.wcUri, '');
  assert.equal(adapter.relayStatus, 'waiting');
  adapter.destroy();
});

test('provider polling stops once a provider is found', async () => {
  const adapter = new MorselCookieWalletAdapter();
  assert.notEqual(adapter.refreshIntervalId, null, 'polling at first');
  globalThis.window.morsel = { connect: async () => ({}), signTransaction: async (t) => t };
  try {
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal(adapter.readyState, 'Installed');
    assert.equal(adapter.refreshIntervalId, null, 'polling stopped');
  } finally {
    delete globalThis.window.morsel;
    adapter.destroy();
  }
});

// ---- the approve proof -----------------------------------------------------------------------------

test('the signed payload has the documented layout', () => {
  const dapp = new Uint8Array(32).fill(1);
  const wallet = new Uint8Array(32).fill(2);
  const address = new Uint8Array(32).fill(3);
  const payload = approveProofPayload({ sessionId: 'SESSION', dappX25519Pub: dapp, walletX25519Pub: wallet, walletAddress: address });
  assert.equal(
    new TextDecoder().decode(payload),
    ['morsel-connect/approve/v1', 'SESSION', toBase64Url(dapp), toBase64Url(wallet), bs58.encode(address)].join('\n')
  );
  assert.equal(toBase64Url(dapp).length, 43, 'base64url of 32 bytes, no padding');
  const kp = nacl.sign.keyPair();
  const input = { sessionId: 'SESSION', dappX25519Pub: dapp, walletX25519Pub: wallet, walletAddress: kp.publicKey };
  const sig = bs58.encode(nacl.sign.detached(approveProofPayload(input), kp.secretKey));
  assert.equal(verifyApproveProof(input, sig), true);
  assert.equal(verifyApproveProof(input, undefined), false);
  assert.equal(verifyApproveProof(input, 'not base58 0OIl'), false);
  assert.equal(verifyApproveProof(input, sig, 'junk-envelope'), false);
});

test('a valid proof approves the session and exposes the peer fingerprint', () => {
  const { adapter, ws, phone, errors } = pair();
  assert.equal(adapter.relayStatus, 'scanned');
  const connects = [];
  adapter.on('connect', (pk) => connects.push(pk.toBase58()));
  phone.approve(ws);
  assert.deepEqual(connects, [phone.address]);
  assert.equal(adapter.connected, true);
  assert.equal(adapter.publicKey.toBase58(), phone.address);
  assert.equal(adapter.relayStatus, 'connected');
  assert.equal(adapter.readyState, 'Installed');
  assert.match(adapter.relayPeerFingerprint, /^[0-9a-f]{4}-[0-9a-f]{4}$/);
  assert.equal(adapter.relayPeerFingerprint, relayPeerFingerprint(phone.box.publicKey));
  assert.deepEqual(errors, []);
  adapter.destroy();
});

test('an approve without a signature (an older wallet) is refused: no connection, an error, a fresh QR', () => {
  const { adapter, ws, phone, errors } = pair();
  const oldUri = adapter.wcUri;
  const sockets = FakeWebSocket.instances.length;
  phone.send(ws, { type: 'session_approve', id: phone.proposalId(ws), walletAddress: phone.address });
  assert.equal(adapter.connected, false);
  assert.equal(adapter.publicKey, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /update/i);
  assert.notEqual(adapter.wcUri, oldUri, 'a new session was minted');
  assert.equal(FakeWebSocket.instances.length, sockets + 1);
  assert.equal(ws.readyState, 3, 'the spent session is closed');
  assert.equal(adapter.relayStatus, 'waiting');
  adapter.destroy();
});

test('a forged proof is refused: another key, another channel key, another session, another address', () => {
  const cases = [
    (phone) => ({ signature: phone.signature(phone.payload(), nacl.sign.keyPair().secretKey) }),
    (phone) => ({ signature: phone.signature(phone.payload({ walletX25519Pub: nacl.box.keyPair().publicKey })) }),
    (phone) => ({ signature: phone.signature(phone.payload({ sessionId: 'someone-elses-session' })) }),
    (phone) => {
      // A real signature from the phone's key, but claiming someone else's address.
      const other = nacl.sign.keyPair();
      return { walletAddress: bs58.encode(other.publicKey), signature: phone.signature(phone.payload({ walletAddress: other.publicKey })) };
    },
    () => ({ signature: 'zz' }),
    () => ({ signature: 42 }),
  ];
  for (const forge of cases) {
    const { adapter, ws, phone, errors } = pair();
    phone.approve(ws, forge(phone));
    assert.equal(adapter.connected, false, 'refused');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /could not prove/);
    assert.equal(adapter.relayStatus, 'waiting');
    adapter.destroy();
  }
});

test('a proof is bound to its session: one from another QR does not approve this one', () => {
  const a = pair();
  const b = pair();
  // The phone that scanned A tries A's proof on B's session (same account, same channel key).
  b.phone.box = a.phone.box;
  b.phone.sign = a.phone.sign;
  b.phone.address = a.phone.address;
  b.phone.send(b.ws, { type: 'session_approve', id: b.phone.proposalId(b.ws), walletAddress: a.phone.address, signature: a.phone.signature() });
  assert.equal(b.adapter.connected, false);
  a.adapter.destroy();
  b.adapter.destroy();
});

test('only the first wallet_hello binds the channel; a later one is ignored', () => {
  const { adapter, ws, phone } = pair();
  const intruder = new Phone(adapter.wcUri);
  intruder.hello(ws);
  assert.equal(ws.sent.filter((m) => m.type === 'enc').length, 1, 'one proposal, to the first phone');
  assert.equal(phone.inbox(ws).length, 1);
  assert.equal(intruder.inbox(ws).length, 0, 'the intruder cannot read the proposal');
  intruder.approve(ws, { id: phone.proposalId(ws) });
  assert.equal(adapter.connected, false, 'nothing boxed to the intruder key is accepted');
  phone.approve(ws);
  assert.equal(adapter.connected, true);
  assert.equal(adapter.publicKey.toBase58(), phone.address);
  adapter.destroy();
});

test('a malformed hello binds nothing, so the real phone can still pair', () => {
  const adapter = new MorselCookieWalletAdapter();
  adapter.on('error', () => {});
  adapter.startRelaySession();
  const ws = lastSocket();
  ws.receive({ type: 'wallet_hello', pubkey: toBase64Url(new Uint8Array(5)) });
  ws.receive({ type: 'wallet_hello' });
  assert.equal(ws.sent.length, 0, 'no proposal for a bad key');
  const phone = new Phone(adapter.wcUri);
  phone.hello(ws);
  phone.approve(ws);
  assert.equal(adapter.connected, true);
  adapter.destroy();
});

test('a hardware wallet signs the off-chain envelope carrying the payload; a wrong envelope is refused', () => {
  const envelope = (payload, header = OFFCHAIN) => {
    const body = new Uint8Array([...header, 1, 1, ...new Uint8Array(32), ...payload]);
    return body;
  };
  {
    const { adapter, ws, phone } = pair();
    const env = envelope(phone.payload());
    phone.approve(ws, { signature: bs58.encode(nacl.sign.detached(env, phone.sign.secretKey)), signedMessage: bs58.encode(env) });
    assert.equal(adapter.connected, true, 'envelope accepted');
    adapter.destroy();
  }
  {
    const { adapter, ws, phone } = pair();
    const env = envelope(phone.payload(), new TextEncoder().encode('not an envelope!'));
    phone.approve(ws, { signature: bs58.encode(nacl.sign.detached(env, phone.sign.secretKey)), signedMessage: bs58.encode(env) });
    assert.equal(adapter.connected, false, 'wrong header refused');
    adapter.destroy();
  }
  {
    const { adapter, ws, phone } = pair();
    // An envelope whose body is a different payload (another session), signed for real.
    const env = envelope(phone.payload({ sessionId: 'other' }));
    phone.approve(ws, { signature: bs58.encode(nacl.sign.detached(env, phone.sign.secretKey)), signedMessage: bs58.encode(env) });
    assert.equal(adapter.connected, false, 'envelope with another payload refused');
    adapter.destroy();
  }
});

// ---- signing results are bound to their request ------------------------------------------------------

test('signTransaction (relay): a returned transaction with a different message is refused', async () => {
  const { adapter, ws, phone } = connectedPair();
  const from = new PublicKey(phone.address);
  const p = adapter.signTransaction(legacyTx(from, 1000));
  await tick();
  const other = legacyTx(from, 999_999);
  other.partialSign(Keypair.fromSecretKey(phone.sign.secretKey));
  answer(phone, ws, { transaction: toBase64(wire(other)) });
  await assert.rejects(p, (e) => e instanceof WalletSignTransactionError && /does not match/.test(e.message));
  adapter.destroy();
});

test('signTransaction (relay): the same message with no valid signature for the account is refused', async () => {
  const { adapter, ws, phone } = connectedPair();
  const from = new PublicKey(phone.address);
  const tx = legacyTx(from);
  const p = adapter.signTransaction(tx);
  await tick();
  const req = answer(phone, ws, { transaction: toBase64(wire(tx)) }); // unsigned, same message
  assert.equal(req.type, 'sign_transaction');
  await assert.rejects(p, (e) => e instanceof WalletSignTransactionError && /no valid signature/.test(e.message));

  const p2 = adapter.signTransaction(tx);
  await tick();
  const garbage = Transaction.from(wire(tx));
  garbage.signatures[0].signature = Buffer.from(new Uint8Array(64).fill(5));
  answer(phone, ws, { transaction: toBase64(wire(garbage)) });
  await assert.rejects(p2, WalletSignTransactionError);
  adapter.destroy();
});

test('signTransaction (relay): the request, signed by the account, is returned (legacy and v0)', async () => {
  const { adapter, ws, phone } = connectedPair();
  const from = new PublicKey(phone.address);
  const kp = Keypair.fromSecretKey(phone.sign.secretKey);

  const tx = legacyTx(from);
  const p = adapter.signTransaction(tx);
  await tick();
  const signedByPhone = Transaction.from(wire(tx));
  signedByPhone.partialSign(kp);
  answer(phone, ws, { transaction: toBase64(wire(signedByPhone)) });
  const signed = await p;
  assert.ok(signed instanceof Transaction);
  assert.equal(signed.verifySignatures(), true);
  assert.deepEqual(new Uint8Array(signed.serializeMessage()), new Uint8Array(tx.serializeMessage()));

  const vtx = v0Tx(from);
  const p2 = adapter.signTransaction(vtx);
  await tick();
  const vsigned = VersionedTransaction.deserialize(vtx.serialize());
  vsigned.sign([kp]);
  answer(phone, ws, { transaction: toBase64(vsigned.serialize()) });
  const got = await p2;
  assert.ok(got instanceof VersionedTransaction);
  assert.deepEqual(got.message.serialize(), vtx.message.serialize());
  assert.equal(nacl.sign.detached.verify(got.message.serialize(), got.signatures[0], phone.sign.publicKey), true);
  adapter.destroy();
});

test('signTransaction (injected provider): a provider answering with another transaction is refused', async () => {
  const kp = Keypair.generate();
  globalThis.window.morsel = {
    connect: async () => ({ publicKey: kp.publicKey.toBase58() }),
    signTransaction: async (tx) => {
      const other = legacyTx(kp.publicKey, 5);
      other.partialSign(kp);
      return other;
    },
  };
  try {
    const adapter = new MorselCookieWalletAdapter();
    adapter.on('error', () => {});
    await adapter.connect();
    await assert.rejects(adapter.signTransaction(legacyTx(kp.publicKey)), (e) => e instanceof WalletSignTransactionError && /does not match/.test(e.message));
    globalThis.window.morsel.signTransaction = async (tx) => { tx.partialSign(kp); return tx; };
    const ok = await adapter.signTransaction(legacyTx(kp.publicKey));
    assert.equal(ok.verifySignatures(), true);
    adapter.destroy();
  } finally {
    delete globalThis.window.morsel;
  }
});

test('signMessage (relay): a signature that does not verify for the account is refused; a good one is returned', async () => {
  const { adapter, ws, phone } = connectedPair();
  const message = new TextEncoder().encode('hello morsel');

  const p = adapter.signMessage(message);
  await tick();
  answer(phone, ws, { signature: bs58.encode(nacl.sign.detached(message, nacl.sign.keyPair().secretKey)), publicKey: phone.address });
  await assert.rejects(p, (e) => e instanceof WalletSignMessageError && /does not verify/.test(e.message));

  const p2 = adapter.signMessage(message);
  await tick();
  answer(phone, ws, { signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode('other text'), phone.sign.secretKey)) });
  await assert.rejects(p2, WalletSignMessageError);

  const p3 = adapter.signMessage(message);
  await tick();
  const sig = nacl.sign.detached(message, phone.sign.secretKey);
  answer(phone, ws, { signature: bs58.encode(sig), publicKey: phone.address });
  const res = await p3;
  assert.deepEqual(res.signature, sig);
  assert.equal(res.signedMessage, undefined);

  // A hardware wallet: the signature is over an envelope carrying the message, which is returned too.
  const p4 = adapter.signMessage(message);
  await tick();
  const env = new Uint8Array([...OFFCHAIN, 1, 1, ...phone.sign.publicKey, ...message]);
  answer(phone, ws, { signature: bs58.encode(nacl.sign.detached(env, phone.sign.secretKey)), signedMessage: bs58.encode(env) });
  const hw = await p4;
  assert.deepEqual(hw.signedMessage, env);
  assert.equal(nacl.sign.detached.verify(hw.signedMessage, hw.signature, phone.sign.publicKey), true);
  adapter.destroy();
});

test('disconnect() ends the paired session and leaves the relay idle until a QR is asked for again', async () => {
  const { adapter, ws } = connectedPair();
  const sockets = FakeWebSocket.instances.length;
  await adapter.disconnect();
  assert.equal(adapter.connected, false);
  assert.equal(adapter.relayStatus, 'idle');
  assert.equal(adapter.wcUri, '');
  assert.equal(adapter.relayPeerFingerprint, null);
  assert.equal(ws.readyState, 3);
  assert.equal(FakeWebSocket.instances.length, sockets, 'no new socket until asked');
  adapter.startRelaySession();
  assert.equal(FakeWebSocket.instances.length, sockets + 1);
  adapter.destroy();
});

// ---- the network, as optional metadata the Morsel app does not need ---------------------------------

test('with a network set, the proposal and each request carry it as `chain`; without one, nothing changes', async () => {
  const FOGO = 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD251';
  {
    const adapter = new MorselCookieWalletAdapter({ chain: 'fogo' });
    adapter.startRelaySession();
    const ws = lastSocket();
    const phone = new Phone(adapter.wcUri);
    phone.hello(ws);
    const proposal = phone.inbox(ws).find((m) => m.type === 'session_proposal');
    assert.deepEqual(proposal.metadata, { name: 'Test dApp', icon: 'https://dapp.test/favicon.ico', origin: 'https://dapp.test', chain: FOGO });
    phone.approve(ws);
    assert.equal(adapter.connected, true, 'the approve proof is unchanged by it');

    const from = new PublicKey(phone.address);
    const p = adapter.signTransaction(legacyTx(from));
    await tick();
    const req = phone.inbox(ws).filter((m) => m.type === 'sign_transaction').pop();
    assert.equal(req.chain, FOGO);
    // The phone signs the request it received; the result is still bound to it (0.3).
    const asked = Transaction.from(fromBase64(req.transaction));
    asked.partialSign(Keypair.fromSecretKey(phone.sign.secretKey));
    phone.send(ws, { type: 'sign_result', id: req.id, transaction: toBase64(wire(asked)) });
    assert.equal((await p).verifySignatures(), true);

    const m = adapter.signMessage(new TextEncoder().encode('hi'));
    await tick();
    assert.equal(phone.inbox(ws).filter((x) => x.type === 'sign_message').pop().chain, FOGO);
    phone.send(ws, { type: 'sign_reject', id: phone.inbox(ws).filter((x) => x.type === 'sign_message').pop().id });
    await assert.rejects(m);

    adapter.setChain('x1');
    const p2 = adapter.signTransaction(legacyTx(from));
    p2.catch(() => {});
    await tick();
    assert.equal(phone.inbox(ws).filter((x) => x.type === 'sign_transaction').pop().chain, 'solana:4SvBP3omtvcCVWdxq1zBY5cDp4wndjsT');
    adapter.destroy();
  }
  {
    const { adapter, ws, phone } = connectedPair();
    const proposal = phone.inbox(ws).find((m) => m.type === 'session_proposal');
    assert.equal('chain' in proposal.metadata, false);
    const p = adapter.signTransaction(legacyTx(new PublicKey(phone.address)));
    p.catch(() => {});
    await tick();
    assert.equal('chain' in phone.inbox(ws).filter((x) => x.type === 'sign_transaction').pop(), false);
    adapter.destroy();
  }
});

test('signAndSendTransaction (relay): sign_and_send_transaction with the network; the answer must be a signature', async () => {
  const { adapter, ws, phone, errors } = connectedPair();
  adapter.setChain('solayer');
  const from = new PublicKey(phone.address);
  const sig = nacl.randomBytes(64);
  const p = adapter.signAndSendTransaction(legacyTx(from));
  await tick();
  const req = phone.inbox(ws).filter((m) => m.type === 'sign_and_send_transaction').pop();
  assert.ok(req, 'asked over the relay');
  assert.equal(req.chain, 'solayer:mainnet');
  assert.equal(Transaction.from(fromBase64(req.transaction)).feePayer.toBase58(), phone.address, 'the transaction, as asked');
  phone.send(ws, { type: 'sign_result', id: req.id, signature: bs58.encode(sig) });
  assert.equal(await p, bs58.encode(sig));

  const p2 = adapter.signAndSendTransaction(legacyTx(from), { chain: 'fogo' });
  await tick();
  const req2 = phone.inbox(ws).filter((m) => m.type === 'sign_and_send_transaction').pop();
  assert.equal(req2.chain, 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD251', 'a request may name its own network');
  phone.send(ws, { type: 'sign_result', id: req2.id, signature: 'zz' });
  await assert.rejects(p2, /no valid signature/);
  assert.equal(errors.length, 1);
  adapter.destroy();
});
