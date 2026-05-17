import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getWallets } from '@wallet-standard/app';
import { MorselCookieWalletAdapter, WalletReadyState, WalletAdapterError, CookieWalletAdapter, StandardWalletAdapter } from '../core';
import { WalletContext } from './WalletContext';
import { WalletProviderProps, WalletContextState } from './types';
import { MORSEL_WALLET_AUTO_CONNECT_KEY } from './constants';

const isBrowser = typeof window !== 'undefined';

function getAutoConnect(): boolean {
  if (!isBrowser) return false;
  try {
    return localStorage.getItem(MORSEL_WALLET_AUTO_CONNECT_KEY) === 'true';
  } catch {
    return false;
  }
}

function setAutoConnect(value: boolean): void {
  if (!isBrowser) return;
  try {
    if (value) {
      localStorage.setItem(MORSEL_WALLET_AUTO_CONNECT_KEY, 'true');
    } else {
      localStorage.removeItem(MORSEL_WALLET_AUTO_CONNECT_KEY);
    }
  } catch {
    // ignore
  }
}

function isSolanaWallet(wallet: any): boolean {
  const features = Object.keys(wallet?.features ?? {});
  const chains: string[] = Array.isArray(wallet?.chains) ? wallet.chains : [];
  return (
    features.some(k => k.startsWith('solana:')) ||
    chains.some(c => c.startsWith('solana:'))
  );
}

export function WalletProvider({ children, adapter: providedAdapter, adapters: providedAdapters, autoConnect = false, onError }: WalletProviderProps) {
  const [standardAdapters, setStandardAdapters] = useState<CookieWalletAdapter[]>([]);
  const standardAdaptersMapRef = useRef<Map<string, StandardWalletAdapter>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { get, on } = getWallets();
    const adapterMap = standardAdaptersMapRef.current;

    const addWallets = (...wallets: any[]) => {
      let changed = false;
      for (const wallet of wallets) {
        const key = String(wallet.name ?? '').toLowerCase();
        if (!key || !isSolanaWallet(wallet) || adapterMap.has(key)) continue;
        adapterMap.set(key, new StandardWalletAdapter(wallet));
        changed = true;
      }
      if (changed) setStandardAdapters([...adapterMap.values()]);
    };

    const removeWallets = (...wallets: any[]) => {
      let changed = false;
      for (const wallet of wallets) {
        const key = String(wallet.name ?? '').toLowerCase();
        if (!adapterMap.has(key)) continue;
        adapterMap.get(key)?.destroy();
        adapterMap.delete(key);
        changed = true;
      }
      if (changed) setStandardAdapters([...adapterMap.values()]);
    };

    addWallets(...get());
    const offRegister = on('register', addWallets);
    const offUnregister = on('unregister', removeWallets);

    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  const adapters = useMemo(() => {
    const staticAdapters = providedAdapters && providedAdapters.length > 0
      ? providedAdapters
      : [providedAdapter || new MorselCookieWalletAdapter()];
    const staticNames = new Set(staticAdapters.map(a => a.name.toLowerCase()));
    const deduped = standardAdapters.filter(a => {
      const aName = a.name.toLowerCase();
      return !Array.from(staticNames).some(sName => sName.includes(aName) || aName.includes(sName));
    });
    return [...staticAdapters, ...deduped];
  }, [providedAdapter, providedAdapters, standardAdapters]);

  const [activeAdapterIndex, setActiveAdapterIndex] = useState(0);
  const activeAdapter = adapters[activeAdapterIndex];
  const adapter = activeAdapter; // for backward compatibility

  const [publicKey, setPublicKey] = useState<WalletContextState['publicKey']>(adapter.publicKey);
  const [connected, setConnected] = useState(adapter.connected);
  const [connecting, setConnecting] = useState(adapter.connecting);
  const [readyState, setReadyState] = useState<WalletReadyState>(adapter.readyState);
  const [error, setError] = useState<Error | null>(null);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const selectAdapter = useCallback(async (index: number): Promise<void> => {
    if (index < 0 || index >= adapters.length) {
      throw new Error(`Adapter index ${index} is out of bounds`);
    }
    if (index === activeAdapterIndex) return;

    // Disconnect current adapter if connected
    if (connected) {
      try {
        await adapter.disconnect();
      } catch (error) {
        // Ignore disconnect errors during switching
      }
    }

    setActiveAdapterIndex(index);
    setError(null);

    // Refresh provider on new adapter
    const newAdapter = adapters[index];
    if ('refreshProvider' in newAdapter && typeof newAdapter.refreshProvider === 'function') {
      try {
        (newAdapter as any).refreshProvider();
      } catch {
        // Ignore refresh errors
      }
    }
  }, [activeAdapterIndex, adapters, adapter, connected]);

  useEffect(() => {
    const handleConnect = (pk: any) => {
      setPublicKey(pk);
      setConnected(true);
      setConnecting(false);
      setError(null);
    };

    const handleDisconnect = () => {
      setPublicKey(null);
      setConnected(false);
      setConnecting(false);
      setError(null);
    };

    const handleReadyStateChange = (state: WalletReadyState) => {
      setReadyState(state);
    };

    const handleError = (err: WalletAdapterError) => {
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
    };

    activeAdapter.on('connect', handleConnect);
    activeAdapter.on('disconnect', handleDisconnect);
    activeAdapter.on('readyStateChange', handleReadyStateChange);
    activeAdapter.on('error', handleError);

    // Sync initial state
    setPublicKey(activeAdapter.publicKey);
    setConnected(activeAdapter.connected);
    setConnecting(activeAdapter.connecting);
    setReadyState(activeAdapter.readyState);

    return () => {
      activeAdapter.off('connect', handleConnect);
      activeAdapter.off('disconnect', handleDisconnect);
      activeAdapter.off('readyStateChange', handleReadyStateChange);
      activeAdapter.off('error', handleError);
    };
  }, [activeAdapter]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !connected && !connecting && getAutoConnect()) {
      activeAdapter.connect().catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        if (onErrorRef.current) {
          onErrorRef.current(err instanceof Error ? err : new Error(String(err)));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, connected, connecting, activeAdapter]);

  const connect = useCallback(() => {
    setConnecting(true);
    return activeAdapter.connect().then(() => {
      setAutoConnect(true);
    }).catch((err) => {
      setAutoConnect(false);
      throw err;
    });
  }, [activeAdapter]);

  const disconnect = useCallback(() => {
    setAutoConnect(false);
    return activeAdapter.disconnect();
  }, [activeAdapter]);

  const signTransaction = useCallback(
    (...args: Parameters<WalletContextState['signTransaction']>) => activeAdapter.signTransaction(...args),
    [activeAdapter]
  );

  const signAllTransactions = useCallback(
    (...args: Parameters<WalletContextState['signAllTransactions']>) => activeAdapter.signAllTransactions(...args),
    [activeAdapter]
  );

  const signMessage = useCallback(
    (...args: Parameters<WalletContextState['signMessage']>) => activeAdapter.signMessage(...args),
    [activeAdapter]
  );

  const sendTransaction = useCallback(
    (...args: Parameters<WalletContextState['sendTransaction']>) => activeAdapter.sendTransaction(...args),
    [activeAdapter]
  );

  const refreshProvider = useCallback(() => {
    if ('refreshProvider' in activeAdapter && typeof (activeAdapter as { refreshProvider: () => void }).refreshProvider === 'function') {
      (activeAdapter as { refreshProvider: () => void }).refreshProvider();
    }
    setReadyState(activeAdapter.readyState);
  }, [activeAdapter]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const contextValue: WalletContextState = {
    wallet: adapter,
    adapters,
    activeAdapter,
    activeAdapterIndex,
    publicKey,
    connected,
    connecting,
    readyState,
    error,
    connect,
    disconnect,
    selectAdapter,
    signTransaction,
    signAllTransactions,
    signMessage,
    sendTransaction,
    refreshProvider,
    clearError,
    on: activeAdapter.on.bind(activeAdapter),
    off: activeAdapter.off.bind(activeAdapter),
  };

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}
