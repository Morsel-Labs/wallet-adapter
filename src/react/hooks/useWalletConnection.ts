import { useState, useCallback } from 'react';
import { useWallet } from '../useWallet';

export function useWalletConnection() {
  const wallet = useWallet();

  const [localConnecting, setLocalConnecting] = useState(false);
  const [localDisconnecting, setLocalDisconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async (): Promise<void> => {
    if (wallet.connected || localConnecting || wallet.connecting) return;
    setLocalConnecting(true);
    setError(null);
    try {
      await wallet.connect();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLocalConnecting(false);
    }
  }, [wallet.connected, wallet.connecting, localConnecting, wallet.connect]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!wallet.connected || localDisconnecting || localConnecting) return;
    setLocalDisconnecting(true);
    setError(null);
    try {
      await wallet.disconnect();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLocalDisconnecting(false);
    }
  }, [wallet.connected, localDisconnecting, localConnecting, wallet.disconnect]);

  const toggleConnection = useCallback(async (): Promise<void> => {
    if (wallet.connected) {
      await disconnect();
    } else {
      await connect();
    }
  }, [wallet.connected, connect, disconnect]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const pending = localConnecting || localDisconnecting || wallet.connecting;

  return {
    connect,
    disconnect,
    toggleConnection,
    connected: wallet.connected,
    connecting: localConnecting,
    disconnecting: localDisconnecting,
    pending,
    error,
    clearError,
  };
}
