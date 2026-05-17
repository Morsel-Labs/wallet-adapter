import { useState, useCallback } from 'react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useWallet } from '../useWallet';

export function useSignTransaction() {
  const wallet = useWallet();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signTransaction = useCallback(
    async (transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      if (signing) throw new Error('Already signing');
      setSigning(true);
      setError(null);
      try {
        return await wallet.signTransaction(transaction);
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

  const signAllTransactions = useCallback(
    async (
      transactions: (Transaction | VersionedTransaction)[]
    ): Promise<(Transaction | VersionedTransaction)[]> => {
      if (signing) throw new Error('Already signing');
      setSigning(true);
      setError(null);
      try {
        return await wallet.signAllTransactions(transactions);
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

  return { signTransaction, signAllTransactions, signing, error, clearError };
}
