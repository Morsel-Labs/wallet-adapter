import { useContext } from 'react';
import { WalletModalContext, WalletModalContextState } from './WalletModalProvider';

export function useOptionalWalletModal(): WalletModalContextState | null {
  return useContext(WalletModalContext);
}
