/**
 * Deterministic stand-ins for everything outside the page, so every stage of the connect widget can
 * be reached on demand (and screenshotted):
 *
 *  - the relay: `WebSocket` to `/relay/` is replaced by an in-page fake that plays the phone. It speaks
 *    the real protocol (peer_joined, wallet_hello, NaCl-boxed session_proposal / approve / reject),
 *    so the adapter's relay code runs unmodified.
 *  - Wallet Standard wallets: fake wallets registered through the real registration events.
 *  - the Morsel extension / in-app browser: an injected `window.morsel` provider.
 *  - the platform: `?platform=ios|android|inapp` fakes the user agent (Playwright can also set it).
 *
 * Everything is driven through `window.__mw`.
 */
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import EventEmitter from 'eventemitter3';

const params = new URLSearchParams(location.search);
const w = window as any;
export const mw: any = (w.__mw = w.__mw || {});
mw.log = [];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise<never>(() => undefined);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function keyFor(name: string) {
  const seed = new Uint8Array(32);
  for (let i = 0; i < name.length; i++) seed[i % 32] = (seed[i % 32] * 31 + name.charCodeAt(i)) & 255;
  return nacl.sign.keyPair.fromSeed(seed);
}
const addressFor = (name: string) => bs58.encode(keyFor(name).publicKey);
export const MORSEL_ADDRESS = addressFor('morsel-demo-account');

// ---- platform ------------------------------------------------------------------------------------
const platform = params.get('platform') || 'desktop';
const UAS: Record<string, string> = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
};
UAS.inapp = UAS.ios;
if (UAS[platform]) Object.defineProperty(navigator, 'userAgent', { get: () => UAS[platform], configurable: true });
if (platform === 'inapp') w.__MORSEL_BRIDGE__ = true;

// ---- relay ---------------------------------------------------------------------------------------
const RealWebSocket = w.WebSocket;
class FakeRelaySocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  url: string;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    relay.latest = this;
    setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      this.onopen?.({});
    }, 20);
  }
  send(data: string) {
    relay.fromDapp(JSON.parse(data));
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
  }
  emit(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}
function WebSocketShim(this: unknown, url: string, protocols?: string | string[]) {
  if (String(url).includes('/relay/')) return new FakeRelaySocket(String(url));
  return new RealWebSocket(url, protocols);
}
Object.assign(WebSocketShim, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
w.WebSocket = WebSocketShim;

const relay: any = (mw.relay = {
  latest: null as FakeRelaySocket | null,
  walletKp: null as nacl.BoxKeyPair | null,
  dappPub: null as Uint8Array | null,
  proposalId: null as string | null,
  /** The phone scans the QR: joins the session and says hello. */
  scan() {
    const s: FakeRelaySocket = relay.latest;
    const uri: string = mw.morsel?.wcUri;
    if (!s || !uri) throw new Error('no live QR');
    const k = new URL(uri.replace('morsel://', 'https://x/')).searchParams.get('k')!;
    relay.dappPub = unb64(k);
    relay.walletKp = nacl.box.keyPair();
    s.emit({ type: 'peer_joined', role: 'wallet' });
    s.emit({ type: 'wallet_hello', pubkey: b64url(relay.walletKp.publicKey) });
  },
  fromDapp(msg: any) {
    if (msg.type !== 'enc' || !relay.walletKp || !relay.dappPub) return;
    const all = unb64(msg.payload);
    const out = nacl.box.open(all.slice(24), all.slice(0, 24), relay.dappPub, relay.walletKp.secretKey);
    if (!out) return;
    const dec = JSON.parse(new TextDecoder().decode(out));
    mw.log.push(dec);
    if (dec.type === 'session_proposal') relay.proposalId = dec.id;
  },
  send(msg: object) {
    const nonce = nacl.randomBytes(24);
    const box = nacl.box(new TextEncoder().encode(JSON.stringify(msg)), nonce, relay.dappPub, relay.walletKp.secretKey);
    const all = new Uint8Array(24 + box.length);
    all.set(nonce);
    all.set(box, 24);
    relay.latest.emit({ type: 'enc', payload: b64(all) });
  },
  approve(address = MORSEL_ADDRESS) {
    relay.send({ type: 'session_approve', id: relay.proposalId, walletAddress: address });
  },
  reject() {
    relay.send({ type: 'session_reject', id: relay.proposalId });
  },
  leave() {
    relay.latest?.emit({ type: 'peer_disconnected', role: 'wallet' });
  },
});

/** Pretend the QR was minted 5 minutes ago. */
mw.expireQr = () => {
  const m = mw.morsel;
  if (!m) return;
  m.wcUriCreatedAt = Date.now() - 5 * 60 * 1000 - 1000;
  m.emit('wcUriChange', m.wcUri);
};

// ---- behaviour knobs for fake wallets ------------------------------------------------------------
mw.walletMode = { mode: params.get('walletMode') || 'approve', delay: Number(params.get('walletDelay') || 900) };

// ---- injected Morsel provider (extension / in-app browser) ---------------------------------------
if (params.get('ext') === '1' || platform === 'inapp') {
  let pk: string | null = null;
  w.morsel = {
    isMorsel: true,
    get publicKey() {
      return pk;
    },
    async connect() {
      await delay(mw.walletMode.delay);
      if (mw.walletMode.mode === 'reject') throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
      if (mw.walletMode.mode === 'error') throw new Error('Morsel is locked. Unlock it and try again.');
      if (mw.walletMode.mode === 'hang') await never();
      pk = MORSEL_ADDRESS;
      return { publicKey: pk };
    },
    async disconnect() {
      pk = null;
    },
    async signTransaction<T>(tx: T) {
      return tx;
    },
    async signMessage() {
      return { signature: new Uint8Array(64) };
    },
    on() {},
    off() {},
  };
}

// ---- Wallet Standard wallets ---------------------------------------------------------------------
function monogram(bg: string, fg: string, letter: string) {
  return (
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg}" stop-opacity=".78"/></linearGradient></defs><rect width="96" height="96" rx="24" fill="url(#g)"/><text x="48" y="63" font-family="Segoe UI,Arial,sans-serif" font-size="44" font-weight="700" fill="${fg}" text-anchor="middle">${letter}</text></svg>`
    )
  );
}

function makeStandardWallet(name: string, bg: string, fg: string) {
  const kp = keyFor(name);
  const address = bs58.encode(kp.publicKey);
  const account = { address, publicKey: kp.publicKey, chains: ['solana:mainnet'], features: ['solana:signTransaction', 'solana:signMessage'] };
  const listeners = new Set<(p: unknown) => void>();
  const wallet: any = {
    version: '1.0.0',
    name,
    icon: monogram(bg, fg, name[0]),
    chains: ['solana:mainnet', 'solana:devnet'],
    accounts: [] as unknown[],
    features: {
      'standard:connect': {
        version: '1.0.0',
        async connect() {
          const cfg = mw.walletMode;
          await delay(cfg.delay);
          if (cfg.mode === 'reject') throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
          if (cfg.mode === 'error') throw new Error(`${name} is locked. Unlock it and try again.`);
          if (cfg.mode === 'hang') await never();
          wallet.accounts = [account];
          listeners.forEach((fn) => fn({ accounts: wallet.accounts }));
          return { accounts: [account] };
        },
      },
      'standard:disconnect': {
        version: '1.0.0',
        async disconnect() {
          wallet.accounts = [];
          listeners.forEach((fn) => fn({ accounts: [] }));
        },
      },
      'standard:events': {
        version: '1.0.0',
        on(_ev: string, fn: (p: unknown) => void) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        async signTransaction(...inputs: Array<{ transaction: Uint8Array }>) {
          return inputs.map((i) => ({ signedTransaction: i.transaction }));
        },
      },
      'solana:signMessage': {
        version: '1.0.0',
        async signMessage(...inputs: Array<{ message: Uint8Array }>) {
          return inputs.map((i) => ({ signedMessage: i.message, signature: new Uint8Array(64) }));
        },
      },
    },
  };
  return wallet;
}

function registerStandard(wallet: unknown) {
  const cb = ({ register }: { register: (w: unknown) => void }) => register(wallet);
  try {
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: cb }));
  } catch {
    /* ignore */
  }
  window.addEventListener('wallet-standard:app-ready', ((e: CustomEvent) => cb(e.detail)) as EventListener);
}

const WALLETS: Record<string, [string, string, string]> = {
  phantom: ['Phantom', '#ab9ff2', '#1c1c3a'],
  backpack: ['Backpack', '#e33e3f', '#ffffff'],
  solflare: ['Solflare', '#fc7227', '#1b1b1b'],
  glow: ['Glow', '#1d1d1f', '#c8f560'],
};
const list = (params.get('wallets') ?? 'phantom,backpack,solflare,glow').split(',').filter(Boolean);
for (const id of list) {
  const def = WALLETS[id];
  if (def) registerStandard(makeStandardWallet(...def));
}

// ---- wallets that are not installed (static adapters) --------------------------------------------
class NotInstalledAdapter extends EventEmitter {
  publicKey = null;
  connected = false;
  connecting = false;
  readyState = 'NotDetected' as const;
  supportedTransactionVersions = new Set<'legacy' | 0>(['legacy', 0]);
  constructor(public name: string, public url: string, public icon: string) {
    super();
  }
  async connect() {
    throw new Error(`${this.name} is not installed`);
  }
  async disconnect() {}
  async signTransaction(): Promise<never> {
    throw new Error('not connected');
  }
  async signAllTransactions(): Promise<never> {
    throw new Error('not connected');
  }
  async signMessage(): Promise<never> {
    throw new Error('not connected');
  }
  async sendTransaction(): Promise<never> {
    throw new Error('not connected');
  }
}
export const notInstalled =
  params.get('more') === '0'
    ? []
    : [
        new NotInstalledAdapter('Trust', 'https://trustwallet.com', monogram('#3375bb', '#fff', 'T')),
        new NotInstalledAdapter('Coinbase Wallet', 'https://www.coinbase.com/wallet', monogram('#0052ff', '#fff', 'C')),
      ];

/** A Connection stand-in so the account chip can show a balance. */
export const fakeConnection: any = {
  async getBalance() {
    await delay(150);
    return 1284.5675 * 1e9;
  },
};
