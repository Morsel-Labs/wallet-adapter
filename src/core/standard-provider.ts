import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getWallets } from '@wallet-standard/app';
import type { MorselCookieProvider } from './types';

/**
 * Wallet-Standard fallback for the Morsel wallet.
 *
 * If the Morsel extension registered through the Wallet Standard (which it does) but did not
 * expose a usable injected `window.morsel` provider, the Morsel card in the connect kit should
 * still work. This finds the registered Morsel Standard wallet and adapts its `standard:connect`
 * / `solana:*` features into the same `MorselCookieProvider` shape the adapter already speaks,
 * so `connect()` resolves a provider instead of throwing WalletNotFound.
 */
const MORSEL_NAME = /morsel|dumpsack|cookie/i;
const F_CONNECT = 'standard:connect';
const F_DISCONNECT = 'standard:disconnect';
const F_EVENTS = 'standard:events';
const F_SIGN_TX = 'solana:signTransaction';
const F_SIGN_MSG = 'solana:signMessage';

type AnyWallet = any;
type Listener = (publicKey: PublicKey | string | null) => void;

let cache: { wallet: AnyWallet; provider: MorselCookieProvider } | null = null;

export function detectStandardMorselProvider(): MorselCookieProvider | null {
  if (typeof window === 'undefined') return null;
  let wallets: readonly AnyWallet[] = [];
  try {
    wallets = getWallets().get();
  } catch {
    return null;
  }
  const wallet = wallets.find(
    (w) =>
      !!w &&
      MORSEL_NAME.test(String(w.name ?? '')) &&
      !!w.features?.[F_CONNECT] &&
      !!w.features?.[F_SIGN_TX]
  );
  if (!wallet) {
    cache = null;
    return null;
  }
  // Reuse the same wrapper for a given wallet so the adapter's identity checks (and our
  // event listeners) stay stable across the 1s refresh poll.
  if (cache && cache.wallet === wallet) return cache.provider;
  const provider = wrapStandardWallet(wallet);
  cache = { wallet, provider };
  return provider;
}

function solanaChain(wallet: AnyWallet, account: AnyWallet): string {
  const pick = (ids?: readonly string[]) => ids?.find((c) => c.startsWith('solana:'));
  return (
    pick(account?.chains) ??
    pick(wallet.chains) ??
    account?.chains?.[0] ??
    wallet.chains?.[0] ??
    'solana:mainnet'
  );
}

function wrapStandardWallet(wallet: AnyWallet): MorselCookieProvider {
  let account: AnyWallet = wallet.accounts?.[0] ?? null;
  const listeners = new Map<string, Set<Listener>>();

  // Mirror account / disconnect changes from the Standard wallet onto accountChanged.
  try {
    wallet.features?.[F_EVENTS]?.on?.('change', (props: AnyWallet) => {
      if (props && 'accounts' in props) {
        account = (props.accounts && props.accounts[0]) ?? null;
        const pk = account ? new PublicKey(account.address) : null;
        listeners.get('accountChanged')?.forEach((fn) => fn(pk));
      }
    });
  } catch {
    /* the events feature is optional */
  }

  const provider: MorselCookieProvider = {
    get publicKey() {
      return account ? new PublicKey(account.address) : null;
    },
    async connect() {
      const res = await wallet.features[F_CONNECT].connect();
      account = (res?.accounts && res.accounts[0]) ?? wallet.accounts?.[0] ?? null;
      if (!account) throw new Error('Morsel wallet returned no account');
      return { publicKey: new PublicKey(account.address) };
    },
    async disconnect() {
      try {
        await wallet.features[F_DISCONNECT]?.disconnect?.();
      } catch {
        /* non-fatal */
      }
      account = null;
    },
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
      if (!account) throw new Error('Morsel wallet is not connected');
      const isVersioned = transaction instanceof VersionedTransaction;
      const bytes = isVersioned
        ? (transaction as VersionedTransaction).serialize()
        : (transaction as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false });
      const [out] = await wallet.features[F_SIGN_TX].signTransaction({
        transaction: bytes,
        account,
        chain: solanaChain(wallet, account),
      });
      const signed = out.signedTransaction as Uint8Array;
      return (isVersioned ? VersionedTransaction.deserialize(signed) : Transaction.from(signed)) as T;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
      const out: T[] = [];
      for (const tx of transactions) out.push(await provider.signTransaction(tx));
      return out;
    },
    async signMessage(message: Uint8Array) {
      if (!account) throw new Error('Morsel wallet is not connected');
      const [out] = await wallet.features[F_SIGN_MSG].signMessage({ message, account });
      return { signature: out.signature as Uint8Array };
    },
    on(event, listener) {
      if (event !== 'accountChanged') return;
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
  };
  return provider;
}
