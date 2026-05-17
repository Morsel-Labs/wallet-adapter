import { useMemo } from 'react';
import { useWallet } from '../useWallet';

export function useWalletAddress(): string | null {
  const { publicKey } = useWallet();

  return useMemo(() => {
    if (!publicKey) return null;
    return publicKey.toBase58();
  }, [publicKey]);
}
