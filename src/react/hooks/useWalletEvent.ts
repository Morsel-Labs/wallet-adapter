import { useEffect, useRef } from 'react';
import { useWallet } from '../useWallet';

export function useWalletEvent(eventName: string, listener: (...args: any[]) => void): void {
  const wallet = useWallet();
  const listenerRef = useRef(listener);

  // Keep the ref in sync with the latest listener so we don't resubscribe every render.
  listenerRef.current = listener;

  useEffect(() => {
    // Wrap in a stable handler so we can safely unsubscribe on cleanup.
    const stableHandler = (...args: any[]) => listenerRef.current(...args);

    wallet.on(eventName, stableHandler);
    return () => {
      wallet.off(eventName, stableHandler);
    };
    // `wallet` is stable (memoised in the provider), so this effect only runs on mount/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, wallet]);
}
