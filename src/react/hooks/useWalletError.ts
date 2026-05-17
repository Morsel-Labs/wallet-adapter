import { useWallet } from '../useWallet';

export function useWalletError() {
  const wallet = useWallet();
  return {
    error: wallet.error,
    clearError: wallet.clearError,
  };
}
