import { useCallback, useContext, useRef, useState } from 'react';
import { WalletContext } from '../WalletContext';
import {
  morselPay, MorselPayError, type MorselPayOptions, type MorselPayResult, type MorselPayStatus,
} from '../../core/pay';

export interface UseMorselPay {
  /** Gets the checkout paid: the connected wallet pays in the page, else the hosted checkout opens. */
  pay(checkout: string, options?: Omit<MorselPayOptions, 'checkout' | 'wallet' | 'onStatus' | 'signal'>): Promise<MorselPayResult>;
  status: MorselPayStatus | 'idle' | 'error';
  error: MorselPayError | null;
  result: MorselPayResult | null;
  /** Stops waiting (the payment, if already sent, still lands). */
  cancel(): void;
  reset(): void;
}

/** Morsel Pay with this adapter's wallet when one is connected (works outside a WalletProvider too). */
export function useMorselPay(): UseMorselPay {
  const ctx = useContext(WalletContext);
  const [status, setStatus] = useState<UseMorselPay['status']>('idle');
  const [error, setError] = useState<MorselPayError | null>(null);
  const [result, setResult] = useState<MorselPayResult | null>(null);
  const abort = useRef<AbortController | null>(null);

  const pay = useCallback<UseMorselPay['pay']>(async (checkout, options) => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setResult(null);
    try {
      const r = await morselPay({
        ...options,
        checkout,
        wallet: ctx?.connected && ctx.publicKey ? { publicKey: ctx.publicKey, connected: true, sendTransaction: ctx.sendTransaction } : null,
        onStatus: (s) => setStatus(s),
        signal: ac.signal,
      });
      setResult(r);
      setStatus('paid');
      return r;
    } catch (e) {
      const err = e instanceof MorselPayError ? e : new MorselPayError('network', String((e as Error)?.message || e), e);
      if (err.code !== 'aborted') { setError(err); setStatus('error'); } else setStatus('idle');
      throw err;
    }
  }, [ctx]);

  const cancel = useCallback(() => { abort.current?.abort(); }, []);
  const reset = useCallback(() => { abort.current?.abort(); setStatus('idle'); setError(null); setResult(null); }, []);
  return { pay, status, error, result, cancel, reset };
}
