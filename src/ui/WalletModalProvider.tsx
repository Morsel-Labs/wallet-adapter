import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/** Which screen the connect widget opens on. */
export type WalletModalView = 'wallets' | 'get-morsel';

export interface WalletModalOpenOptions {
  /** Open straight on a screen; defaults to the wallet list. */
  view?: WalletModalView;
  /** Element to anchor the widget to (used with `placement="anchor"`); `ConnectButton` passes itself. */
  anchor?: HTMLElement | null;
}

export interface WalletModalContextState {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  /** Open the widget. Calling it with no argument (or as an event handler) opens the wallet list. */
  open: (options?: WalletModalOpenOptions) => void;
  close: () => void;
  /** Options of the current / last open() call. */
  options: WalletModalOpenOptions;
}

export const WalletModalContext = createContext<WalletModalContextState | null>(null);

function sanitize(options: unknown): WalletModalOpenOptions {
  // open() is often passed straight to onClick, so it may receive an event object.
  if (!options || typeof options !== 'object') return {};
  const o = options as Record<string, unknown>;
  const view = o.view === 'get-morsel' || o.view === 'wallets' ? (o.view as WalletModalView) : undefined;
  const anchor =
    typeof HTMLElement !== 'undefined' && o.anchor instanceof HTMLElement ? (o.anchor as HTMLElement) : undefined;
  return { view, anchor };
}

export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisibleState] = useState(false);
  const [options, setOptions] = useState<WalletModalOpenOptions>({});

  const open = useCallback((opts?: WalletModalOpenOptions) => {
    setOptions(sanitize(opts));
    setVisibleState(true);
  }, []);
  const close = useCallback(() => setVisibleState(false), []);
  const setVisible = useCallback((v: boolean) => {
    if (v) setOptions({});
    setVisibleState(v);
  }, []);

  const contextValue = useMemo<WalletModalContextState>(
    () => ({ visible, setVisible, open, close, options }),
    [visible, setVisible, open, close, options]
  );

  return <WalletModalContext.Provider value={contextValue}>{children}</WalletModalContext.Provider>;
}

export function useWalletModal(): WalletModalContextState {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error('useWalletModal must be used within a WalletModalProvider');
  }
  return context;
}

export function useOptionalWalletModal(): WalletModalContextState | null {
  return useContext(WalletModalContext);
}
