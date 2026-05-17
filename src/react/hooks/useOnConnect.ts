import { useWalletEvent } from './useWalletEvent';

export function useOnConnect(listener: (publicKey: any) => void): void {
  useWalletEvent('connect', listener);
}
