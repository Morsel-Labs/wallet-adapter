import { useState, useCallback } from 'react';
import { Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import { useWallet } from '../useWallet';

export function useSendTransaction() {
  const wallet = useWallet();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
      connection: Connection,
      options?: SendOptions
    ): Promise<TransactionSignature> => {
      if (sending) throw new Error('Already sending');
      setSending(true);
      setError(null);
      try {
        return await wallet.sendTransaction(transaction, connection, options);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [wallet, sending]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { sendTransaction, sending, error, clearError };
}
