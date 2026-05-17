import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, LAMPORTS_PER_SOL, Commitment } from '@solana/web3.js';
import { useWallet } from '../useWallet';

interface UseWalletBalanceOptions {
  autoFetch?: boolean;
  commitment?: Commitment;
}

export function useWalletBalance(
  connection: Connection | null | undefined,
  options: UseWalletBalanceOptions = {}
) {
  const { publicKey } = useWallet();
  const { autoFetch = true, commitment } = options;

  const [balance, setBalance] = useState<number | null>(null);
  const [lamports, setLamports] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) {
      setBalance(null);
      setLamports(null);
      return null;
    }

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const fetchedLamports = await connection.getBalance(publicKey, commitment);
      
      // Only update if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setLamports(fetchedLamports);
        setBalance(fetchedLamports / LAMPORTS_PER_SOL);
      }
      
      return fetchedLamports / LAMPORTS_PER_SOL;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Only set error if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setError(error);
      }
      
      throw error;
    } finally {
      // Only set loading false if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [publicKey, connection, commitment]);

  const refetch = useCallback(async (): Promise<number | null> => {
    return fetchBalance();
  }, [fetchBalance]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchBalance().catch(() => {
        // Auto-fetch errors are stored in state, not thrown
      });
    } else {
      setBalance(null);
      setLamports(null);
      setLoading(false);
      setError(null);
    }
  }, [autoFetch, fetchBalance]);

  return {
    balance,
    lamports,
    loading,
    error,
    refetch,
    clearError,
  };
}
