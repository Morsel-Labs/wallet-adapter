/**
 * The SVM networks a dApp can run on, and how Morsel names each one to the wallet.
 *
 * Mirrors the Morsel wallet's own network registry (src/config/networks/registry.js and the in-page
 * table packages/wallet-standard/src/svm-chains.js); a test keeps the ids below in step with it. A
 * network is identified by its genesis hash:
 *   · `id` is the CAIP-2 chain id, 'solana:' + the first 32 characters of the genesis hash. It is what
 *     the wallet receives on every sign / sign-and-send (wallet-standard `chain`, the injected
 *     provider's `network`), so it signs for that network and refuses a transaction for another.
 *   · a network whose node has no real genesis hash (Solayer) is named by its own id, 'solayer:mainnet'.
 *   · `aliases` are every other id that names the same network: the older wallet-standard ids
 *     ('solana:mainnet', 'gorbagana:testnet-v3'), Backpack's 33-character form, the full hash and the
 *     registry's names ('fogo:mainnet').
 *
 * An id that matches nothing is UNKNOWN: svmChain() answers null and everything that signs or connects
 * refuses it. It is never taken to mean Solana.
 */
import { Connection, type Commitment } from '@solana/web3.js';

export interface SvmChain {
  /** 'solana' | 'solana-devnet' | 'cookie' | 'fogo' | 'sonicsvm' | 'x1' | 'solayer' | a testnet's key. */
  key: string;
  /** What people read: 'Fogo'. */
  name: string;
  /** The chain id the wallet receives: CAIP-2, or 'solayer:mainnet'. */
  id: string;
  /** Every other id that names this network (legacy ids, Backpack's 33 characters, the full genesis hash…). */
  aliases: string[];
  /** Null for a network whose node has none (Solayer). */
  genesisHash: string | null;
  /** The gas token. */
  native: { symbol: string; decimals: number };
  /** A public endpoint for reads. Rate limited: pass your own (WalletProvider `rpcUrl`) in production. */
  rpcUrl: string;
  explorerUrl: string;
  explorerTx(signature: string): string;
  explorerAddress(address: string): string;
  testnet: boolean;
  /** The network mark: a small SVG data URI. */
  icon: string;
}

/** A small round network mark: the network's colour and its initial. */
function mark(color: string, letter: string, fg = '#fff'): string {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${color}"/><text x="16" y="21.5" font-family="system-ui,Arial,sans-serif" font-size="16" font-weight="700" fill="${fg}" text-anchor="middle">${letter}</text></svg>`
    )
  );
}

interface Def {
  key: string;
  name: string;
  genesis: string | null;
  /** The id when there is no genesis hash. */
  chainId?: string;
  aliases: string[];
  symbol: string;
  rpcUrl: string;
  explorer: string;
  /** Path templates under `explorer`, and the query string a test cluster needs. */
  tx: string;
  address: string;
  query?: string;
  testnet?: boolean;
  icon: string;
}

const enc = encodeURIComponent;

function define(d: Def): SvmChain {
  const genesisForms = d.genesis ? [`solana:${d.genesis.slice(0, 33)}`, `solana:${d.genesis}`] : [];
  const id = d.genesis ? `solana:${d.genesis.slice(0, 32)}` : d.chainId!;
  const q = d.query ?? '';
  return Object.freeze({
    key: d.key,
    name: d.name,
    id,
    aliases: Object.freeze([...d.aliases, ...genesisForms]) as unknown as string[],
    genesisHash: d.genesis,
    native: Object.freeze({ symbol: d.symbol, decimals: 9 }),
    rpcUrl: d.rpcUrl,
    explorerUrl: d.explorer,
    explorerTx: (signature: string) => `${d.explorer}${d.tx}${enc(signature)}${q}`,
    explorerAddress: (address: string) => `${d.explorer}${d.address}${enc(address)}${q}`,
    testnet: !!d.testnet,
    icon: d.icon,
  });
}

const SOLANA_MARK = mark('#9945FF', 'S');
const FOGO_MARK = mark('#FF4F1F', 'F');
const X1_MARK = mark('#5B6CFF', 'X');
const SONIC_MARK = mark('#E9C46A', 'S', '#1b1b1b');

/**
 * Every network, mainnets first (Solana, Cookie Chain, Fogo, Sonic SVM, X1, Solayer), then the test
 * networks the wallet knows.
 */
export const SVM_CHAINS: readonly SvmChain[] = Object.freeze([
  define({
    key: 'solana', name: 'Solana', genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    aliases: ['solana:mainnet', 'solana:mainnet-beta', 'solana-mainnet', 'mainnet', 'mainnet-beta'],
    symbol: 'SOL', rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://solscan.io', tx: '/tx/', address: '/account/', icon: SOLANA_MARK,
  }),
  define({
    key: 'cookie', name: 'Cookie Chain', genesis: '9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2',
    aliases: ['gorbagana:testnet-v3', 'cookie:mainnet', 'gorbagana-mainnet', 'gorbagana', 'cookiechain', 'cookie-chain'],
    symbol: 'COOK', rpcUrl: 'https://rpc.cookiescan.io',
    explorer: 'https://cookiescan.io', tx: '/tx/', address: '/address/', icon: mark('#FEB820', 'C', '#1b1b1b'),
  }),
  define({
    key: 'fogo', name: 'Fogo', genesis: 'CDLtwKnaCoK157uaHQDj4fHu72AyD2519Cphmpiq6hvT',
    aliases: ['fogo:mainnet', 'fogo-mainnet'],
    symbol: 'FOGO', rpcUrl: 'https://mainnet.fogo.io',
    explorer: 'https://fogoscan.com', tx: '/tx/', address: '/account/', icon: FOGO_MARK,
  }),
  define({
    key: 'sonicsvm', name: 'Sonic SVM', genesis: '9qoRTAHGWBZHYzMJGkt62wBbFRASj6H7CvoNsNyRw2h4',
    aliases: ['sonicsvm:mainnet', 'sonicsvm-mainnet', 'sonic-svm'],
    symbol: 'SOL', rpcUrl: 'https://api.mainnet-alpha.sonic.game',
    explorer: 'https://explorer.sonicsvm.org', tx: '/tx/', address: '/address/', icon: SONIC_MARK,
  }),
  define({
    key: 'x1', name: 'X1', genesis: '4SvBP3omtvcCVWdxq1zBY5cDp4wndjsThb6nEMn6iMdN',
    aliases: ['x1:mainnet', 'x1-mainnet'],
    symbol: 'XNT', rpcUrl: 'https://rpc.mainnet.x1.xyz',
    explorer: 'https://explorer.mainnet.x1.xyz', tx: '/tx/', address: '/address/', icon: X1_MARK,
  }),
  define({
    // No real genesis hash (the node answers a placeholder), so no CAIP-2 id.
    key: 'solayer', name: 'Solayer', genesis: null, chainId: 'solayer:mainnet',
    aliases: ['solayer-mainnet'],
    symbol: 'SOL', rpcUrl: 'https://mainnet-rpc.solayer.org',
    explorer: 'https://explorer.solayer.org', tx: '/tx/', address: '/address/', icon: mark('#3DAA82', 'S'),
  }),
  define({
    key: 'solana-devnet', name: 'Solana Devnet', genesis: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    aliases: ['solana:devnet', 'devnet'], testnet: true,
    symbol: 'SOL', rpcUrl: 'https://api.devnet.solana.com',
    explorer: 'https://solscan.io', tx: '/tx/', address: '/account/', query: '?cluster=devnet', icon: SOLANA_MARK,
  }),
  define({
    key: 'solana-testnet', name: 'Solana Testnet', genesis: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
    aliases: ['solana:testnet', 'testnet'], testnet: true,
    symbol: 'SOL', rpcUrl: 'https://api.testnet.solana.com',
    explorer: 'https://solscan.io', tx: '/tx/', address: '/account/', query: '?cluster=testnet', icon: SOLANA_MARK,
  }),
  define({
    key: 'fogo-testnet', name: 'Fogo Testnet', genesis: '9GGSFo95raqzZxWqKM5tGYvJp5iv4Dm565S4r8h5PEu9',
    aliases: ['fogo:testnet'], testnet: true,
    symbol: 'FOGO', rpcUrl: 'https://testnet.fogo.io',
    explorer: 'https://fogoscan.com', tx: '/tx/', address: '/account/', query: '?cluster=testnet', icon: FOGO_MARK,
  }),
  define({
    key: 'sonicsvm-testnet', name: 'Sonic SVM Testnet', genesis: 'BRSVhduW2sGkyhrxK6MYqyymirEggFv1hQh8jPqdYBLH',
    aliases: ['sonicsvm:testnet'], testnet: true,
    symbol: 'SOL', rpcUrl: 'https://api.testnet.sonic.game',
    explorer: 'https://explorer.sonicsvm.org', tx: '/tx/', address: '/address/', query: '?cluster=testnet.v1', icon: SONIC_MARK,
  }),
  define({
    key: 'x1-testnet', name: 'X1 Testnet', genesis: 'C7ucgdDEhxLTpXHhWSZxavSVmaNTUJWwT5iTdeaviDho',
    aliases: ['x1:testnet'], testnet: true,
    symbol: 'XNT', rpcUrl: 'https://rpc.testnet.x1.xyz',
    explorer: 'https://explorer.mainnet.x1.xyz', tx: '/tx/', address: '/address/', icon: X1_MARK,
  }),
]);

const INDEX = new Map<string, SvmChain>();
for (const c of SVM_CHAINS) {
  for (const name of [c.key, c.id, ...c.aliases]) if (!INDEX.has(name)) INDEX.set(name, c);
}

/**
 * The network a key ('fogo'), chain id ('solana:CDLtwKnaCoK157uaHQDj4fHu72AyD251', 'solayer:mainnet')
 * or alias ('fogo:mainnet', 'solana:mainnet') names; null when it names none. Exact match (names are
 * also matched lower-cased; chain ids are case-sensitive base58, so 'solana:…' must be exact).
 */
export function svmChain(keyOrId: string): SvmChain | null {
  if (typeof keyOrId !== 'string') return null;
  const raw = keyOrId.trim();
  if (!raw) return null;
  return INDEX.get(raw) ?? (raw.startsWith('solana:') ? null : INDEX.get(raw.toLowerCase()) ?? null);
}

/**
 * A network given by key / id, or a network object you described yourself. Throws for a name that
 * matches nothing: an unknown network is refused, never taken for Solana.
 */
export function resolveSvmChain(chain: SvmChain | string): SvmChain {
  if (chain && typeof chain === 'object' && typeof chain.id === 'string' && chain.id) return chain;
  const found = typeof chain === 'string' ? svmChain(chain) : null;
  if (!found) throw new Error(`Unknown SVM network: ${String(chain)}. Use one of ${SVM_CHAINS.map((c) => c.key).join(', ')}.`);
  return found;
}

/** Every id that names `chain`: its id first, then its aliases. */
export const chainIdsOf = (chain: SvmChain): string[] => [chain.id, ...chain.aliases];

/**
 * A web3.js Connection to `chain` for reads: its public endpoint, or `rpcUrl` (yours). Throws for an
 * unknown network.
 */
export function connectionFor(chain: SvmChain | string, rpcUrl?: string, commitment: Commitment = 'confirmed'): Connection {
  const c = resolveSvmChain(chain);
  return new Connection(rpcUrl || c.rpcUrl, commitment);
}

/** Cookie Chain, in the shape 0.1–0.3 exported (kept for compatibility; see SVM_CHAINS). */
const COOKIE = svmChain('cookie')!;
export const COOKIE_CHAIN = Object.freeze({
  name: COOKIE.name,
  chainId: 'cookie-mainnet',
  symbol: COOKIE.native.symbol,
  rpcUrl: COOKIE.rpcUrl,
  explorerUrl: COOKIE.explorerUrl,
});
