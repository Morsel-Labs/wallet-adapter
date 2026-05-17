import { useState, useCallback } from 'react';
import { useWallet } from '../useWallet';

export function useSignMessage() {
  const wallet = useWallet();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (signing) throw new Error('Message signing already in progress');
      setSigning(true);
      setError(null);
      try {
        const result = await wallet.signMessage(message);
        return result.signature;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setSigning(false);
      }
    },
    [wallet, signing]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { signMessage, signing, error, clearError };
}
