/**
 * Morsel Pay in a site: `morselPay({ checkout })` takes a checkout your server created (POST
 * /v1/pay/checkout/sessions with your secret key, which answers its `id`) and gets it paid, then resolves
 * once the payment is on chain. Non-custodial: the customer's wallet pays you directly, Morsel's fee in the
 * same transaction.
 *
 *   wallet   a connected wallet (this adapter's, or any with `publicKey` and `sendTransaction`): the
 *            payment transaction is asked for that wallet (the Solana Pay transaction request) and sent
 *            from it, right in the page. Morsel shows its simulation and Morsel Guard before it signs.
 *   page     no wallet connected: the hosted checkout (morselwallet.app/checkout/<id>) opens in a popup
 *            (Pay with Morsel, or any Solana wallet by its QR). Blocked popups fall back to a redirect, and
 *            the checkout's success_url brings the customer back.
 *
 * Either way the answer comes from Morsel's API, which watches the chain: the promise resolves when the
 * checkout is `paid`, never because a wallet said it sent something. It rejects with a MorselPayError
 * whose `code` says why (expired, closed, rejected, not_found, aborted, timeout, network).
 */
import { Connection, Transaction, VersionedTransaction, type PublicKey, type SendOptions } from '@solana/web3.js';
import { COOKIE_CHAIN } from './chains';
import { fromBase64 } from './base64';

export const MORSEL_PAY_API = 'https://api.dumpsack.xyz';
export const MORSEL_PAY_CHECKOUT = 'https://morselwallet.app';

export type MorselPayStatus = 'loading' | 'signing' | 'confirming' | 'waiting' | 'paid';
export type MorselPayErrorCode = 'expired' | 'closed' | 'rejected' | 'not_found' | 'aborted' | 'timeout' | 'network';

export class MorselPayError extends Error {
  constructor(public code: MorselPayErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = 'MorselPayError';
  }
}

/** A checkout as GET /v1/pay/checkout/:id answers it. */
export interface MorselCheckout {
  id: string;
  status: 'open' | 'paid' | 'expired' | 'canceled';
  livemode: boolean;
  network: 'solana' | 'cookie';
  token: string;
  mint: string | null;
  amount: string;
  description: string | null;
  merchant: { name: string; logo_url: string | null; website: string | null };
  success_url: string | null;
  cancel_url: string | null;
  signature: string | null;
  expires_at: string;
  solana_pay: string;
}

export interface MorselPayResult {
  id: string;
  status: 'paid';
  signature: string | null;
  network: 'solana' | 'cookie';
  token: string;
  amount: string;
  /** How it was paid: from the connected wallet, or on the hosted checkout. */
  via: 'wallet' | 'page';
}

/** What `morselPay` needs of a wallet: this adapter's, or any Solana wallet adapter. */
export interface MorselPayWallet {
  publicKey: PublicKey | null;
  connected?: boolean;
  sendTransaction(transaction: Transaction | VersionedTransaction, connection: Connection, options?: SendOptions): Promise<string>;
}

export interface MorselPayOptions {
  /** The checkout's id (cs_…), or its URL (https://morselwallet.app/checkout/cs_…). */
  checkout: string;
  /** A connected wallet pays in the page; without one the hosted checkout opens. */
  wallet?: MorselPayWallet | null;
  /** 'auto' (default): the wallet when one is connected, else the page. */
  mode?: 'auto' | 'wallet' | 'page';
  onStatus?: (status: MorselPayStatus, checkout?: MorselCheckout) => void;
  signal?: AbortSignal;
  /** Overrides, for a staging API or your own RPC. */
  apiOrigin?: string;
  checkoutOrigin?: string;
  rpcUrl?: string;
  pollMs?: number;
  fetch?: typeof fetch;
}

const ID = /^cs_[A-Za-z0-9]{6,64}$/;

/** The checkout id in an id or a checkout URL, or null. */
export function checkoutIdOf(checkout: string): string | null {
  const text = String(checkout || '').trim();
  if (ID.test(text)) return text;
  try {
    const segs = new URL(text).pathname.split('/').filter(Boolean);
    const i = segs.indexOf('checkout');
    const id = i >= 0 ? segs[i + 1] : null;
    return id && ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** The hosted checkout page for an id. */
export const morselCheckoutUrl = (id: string, origin = MORSEL_PAY_CHECKOUT) => `${origin.replace(/\/+$/, '')}/checkout/${id}`;

/** The RPC a checkout's transaction is sent through. */
export function payRpcUrl(c: Pick<MorselCheckout, 'network' | 'livemode'>): string {
  if (c.network === 'cookie') return COOKIE_CHAIN.rpcUrl;
  return c.livemode ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com';
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(new MorselPayError('aborted', 'The payment was stopped.')); return; }
  const t = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
  const stop = () => { clearTimeout(t); reject(new MorselPayError('aborted', 'The payment was stopped.')); };
  signal?.addEventListener('abort', stop, { once: true });
});

const isRejection = (e: unknown) => /reject|denied|cancel|declin|user/i.test(String((e as { message?: string })?.message || e));

export async function morselPay(o: MorselPayOptions): Promise<MorselPayResult> {
  const id = checkoutIdOf(o.checkout);
  if (!id) throw new MorselPayError('not_found', 'That is not a Morsel Pay checkout.');
  const api = (o.apiOrigin || MORSEL_PAY_API).replace(/\/+$/, '');
  const doFetch = o.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new MorselPayError('network', 'No fetch available.');
  const pollMs = Math.max(500, o.pollMs ?? 2500);
  const emit = (s: MorselPayStatus, c?: MorselCheckout) => { try { o.onStatus?.(s, c); } catch { /* the caller's */ } };

  const read = async (): Promise<MorselCheckout> => {
    let res: Response;
    try {
      res = await doFetch(`${api}/v1/pay/checkout/${id}`, { headers: { accept: 'application/json' }, cache: 'no-store', signal: o.signal });
    } catch (e) {
      if (o.signal?.aborted) throw new MorselPayError('aborted', 'The payment was stopped.');
      throw new MorselPayError('network', 'Morsel Pay could not be reached.', e);
    }
    if (res.status === 404) throw new MorselPayError('not_found', 'This checkout does not exist.');
    if (!res.ok) throw new MorselPayError('network', `Morsel Pay answered ${res.status}.`);
    return res.json() as Promise<MorselCheckout>;
  };
  const done = (c: MorselCheckout, via: 'wallet' | 'page'): MorselPayResult => {
    emit('paid', c);
    return { id, status: 'paid', signature: c.signature, network: c.network, token: c.token, amount: c.amount, via };
  };
  const closed = (c: MorselCheckout) => (c.status === 'expired' || (c.status === 'open' && Date.parse(c.expires_at) <= Date.now())
    ? new MorselPayError('expired', 'This checkout expired.')
    : c.status === 'canceled' ? new MorselPayError('closed', 'This checkout was canceled.') : null);

  /** Until Morsel's API has seen it on chain (or the checkout ends). A network blip is retried. */
  const untilPaid = async (via: 'wallet' | 'page', stillWaiting?: () => boolean): Promise<MorselPayResult> => {
    for (;;) {
      await sleep(pollMs, o.signal);
      let c: MorselCheckout;
      try { c = await read(); } catch (e) {
        if ((e as MorselPayError).code === 'network') continue;
        throw e;
      }
      if (c.status === 'paid') return done(c, via);
      const end = closed(c);
      if (end) throw end;
      if (stillWaiting && !stillWaiting()) {
        // The popup was closed: one last look, then it is the customer's choice.
        await sleep(pollMs, o.signal);
        const last = await read().catch(() => c);
        if (last.status === 'paid') return done(last, via);
        throw new MorselPayError('closed', 'The checkout was closed before it was paid.');
      }
    }
  };

  emit('loading');
  const first = await read();
  if (first.status === 'paid') return done(first, 'page');
  const ended = closed(first);
  if (ended) throw ended;

  const wallet = o.wallet && o.wallet.publicKey && o.wallet.connected !== false ? o.wallet : null;
  const useWallet = o.mode === 'wallet' || (o.mode !== 'page' && !!wallet);
  if (useWallet) {
    if (!wallet) throw new MorselPayError('rejected', 'Connect a wallet to pay.');
    emit('signing', first);
    let txB64: string;
    try {
      const res = await doFetch(`${api}/v1/pay/checkout/${id}/solana-pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ account: wallet.publicKey!.toBase58() }),
        signal: o.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body?.error?.message || body?.message || `Morsel Pay answered ${res.status}.`;
        throw new MorselPayError(res.status === 409 ? 'expired' : 'network', msg);
      }
      txB64 = body.transaction;
    } catch (e) {
      if (e instanceof MorselPayError) throw e;
      if (o.signal?.aborted) throw new MorselPayError('aborted', 'The payment was stopped.');
      throw new MorselPayError('network', 'Morsel Pay could not be reached.', e);
    }
    const bytes = fromBase64(txB64);
    let tx: Transaction | VersionedTransaction;
    try { tx = Transaction.from(bytes); } catch { tx = VersionedTransaction.deserialize(bytes); }
    try {
      await wallet.sendTransaction(tx, new Connection(o.rpcUrl || payRpcUrl(first), 'confirmed'), { skipPreflight: false });
    } catch (e) {
      if (isRejection(e)) throw new MorselPayError('rejected', 'The payment was not approved in the wallet.', e);
      throw new MorselPayError('network', 'The wallet could not send the payment.', e);
    }
    emit('confirming', first);
    return untilPaid('wallet');
  }

  // The hosted checkout: a popup when the browser allows it, else this tab goes there (and comes back
  // through the checkout's success_url).
  const url = morselCheckoutUrl(id, o.checkoutOrigin);
  if (typeof window === 'undefined') throw new MorselPayError('network', 'The hosted checkout needs a browser.');
  const w = 440;
  const h = 760;
  const left = Math.max(0, (window.screenX || 0) + ((window.outerWidth || w) - w) / 2);
  const top = Math.max(0, (window.screenY || 0) + ((window.outerHeight || h) - h) / 2);
  const popup = window.open(url, 'morsel-pay', `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) {
    window.location.assign(url);
    emit('waiting', first);
    return new Promise<MorselPayResult>(() => { /* this page is leaving */ });
  }
  emit('waiting', first);
  try {
    return await untilPaid('page', () => !popup.closed);
  } finally {
    try { if (!popup.closed) popup.close(); } catch { /* another origin's window */ }
  }
}
