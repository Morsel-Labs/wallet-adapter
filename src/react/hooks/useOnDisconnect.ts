import { useWalletEvent } from './useWalletEvent';

export function useOnDisconnect(listener: () => void): void {
  useWalletEvent('disconnect', listener);
}
