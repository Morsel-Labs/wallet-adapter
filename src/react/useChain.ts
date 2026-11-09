import { useContext } from 'react';
import { ChainContext, ChainContextState } from './ChainContext';

/** The app's network, the ones it offers, a way to switch, and a Connection to read from it. */
export function useChain(): ChainContextState {
  const context = useContext(ChainContext);
  if (!context) throw new Error('useChain must be used within a WalletProvider');
  return context;
}

/** useChain(), or null outside a WalletProvider. */
export function useOptionalChain(): ChainContextState | null {
  return useContext(ChainContext);
}
