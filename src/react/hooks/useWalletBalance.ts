import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, Commitment } from '@solana/web3.js';
import { useWallet } from '../useWallet';
import { useOptionalChain } from '../useChain';

interface UseWalletBalanceOptions {
  autoFetch?: boolean;
  commitment?: Commitment;
}

/**
 * The connected account's native balance on the app's network.
 *
 * `connection`: leave it out for useChain().connection (the app's network); pass one to read
 * elsewhere, or `null` to read nothing. `balance` is in the network's gas token (`symbol`).
 */
export function useWalletBalance(
  connection?: Connection | null,
  options: UseWalletBalanceOptions = {}
) {
  const { publicKey } = useWallet();
  const chainState = useOptionalChain();
  if (connection === undefined) connection = chainState?.connection ?? null;
  const decimals = chainState?.chain.native.decimals ?? 9;
  const symbol = chainState?.chain.native.symbol ?? null;
  const unit = 10 ** decimals;
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
        setBalance(fetchedLamports / unit);
      }
      
      return fetchedLamports / unit;
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
  }, [publicKey, connection, commitment, unit]);

  const refetch = useCallback(async (): Promise<number | null> => {
    return fetchBalance();
  }, [fetchBalance]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Another network or account: the old figure is not this one's.
  useEffect(() => {
    setBalance(null);
    setLamports(null);
  }, [connection, publicKey]);

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
    /** The gas token's symbol on the app's network ('FOGO'); null outside a WalletProvider. */
    symbol,
    lamports,
    loading,
    error,
    refetch,
    clearError,
  };
}
