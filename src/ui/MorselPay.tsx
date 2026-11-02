import React, { useCallback } from 'react';
import { MORSEL_LOGO_DATA_URI } from '../core/constants';
import type { MorselPayError, MorselPayOptions, MorselPayResult } from '../core/pay';
import { useMorselPay } from '../react/hooks/useMorselPay';
import { useKitStyles } from './kit/styles';

export interface MorselPayProps {
  /**
   * The checkout to pay: its id (cs_…), or a function that creates it on your server when the button is
   * pressed (POST /v1/pay/checkout/sessions with your secret key) and returns the id.
   */
  checkout: string | (() => Promise<string>);
  onPaid?(result: MorselPayResult): void;
  onError?(error: MorselPayError): void;
  /** Default "Pay with Morsel". */
  label?: React.ReactNode;
  disabled?: boolean;
  size?: 'md' | 'sm';
  /** Your own class: the button is then unstyled. */
  className?: string;
  style?: React.CSSProperties;
  nonce?: string;
  options?: Omit<MorselPayOptions, 'checkout' | 'wallet' | 'onStatus' | 'signal'>;
}

const BUSY_LABEL: Record<string, string> = {
  loading: 'Opening…', signing: 'Approve in your wallet…', confirming: 'Confirming…', waiting: 'Finish in the checkout…',
};

/**
 * The Morsel Pay button. With a wallet connected through this adapter the customer pays right here (one
 * approval in the wallet); without one the hosted checkout opens. `onPaid` fires once Morsel has seen
 * the payment on chain.
 */
export function MorselPay({
  checkout, onPaid, onError, label = 'Pay with Morsel', disabled, size = 'md', className, style, nonce, options,
}: MorselPayProps) {
  useKitStyles(nonce);
  const { pay, status, error } = useMorselPay();
  const busy = status === 'loading' || status === 'signing' || status === 'confirming' || status === 'waiting';

  const onClick = useCallback(async () => {
    if (busy) return;
    try {
      const id = typeof checkout === 'function' ? await checkout() : checkout;
      const r = await pay(id, options);
      onPaid?.(r);
    } catch (e) {
      const err = e as MorselPayError;
      if (err?.code !== 'aborted') onError?.(err);
    }
  }, [busy, checkout, pay, options, onPaid, onError]);

  const text = status === 'paid' ? 'Paid' : busy ? BUSY_LABEL[status] : label;
  const unstyled = className !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy || status === 'paid'}
      aria-busy={busy}
      data-status={status}
      title={error && status === 'error' ? error.message : undefined}
      className={unstyled ? className : `mw-scope mw-cbtn${size === 'sm' ? ' mw-sm' : ''}`}
      style={style}
    >
      {unstyled ? null : busy
        ? <span className="mw-spin" aria-hidden="true" />
        : <img className="mw-logo-img" src={MORSEL_LOGO_DATA_URI} alt="" width={20} height={20} draggable={false} />}
      {text}
    </button>
  );
}
