import { useWalletEvent } from './useWalletEvent';

export function useOnWalletError(listener: (error: Error) => void): void {
  useWalletEvent('error', listener);
}
