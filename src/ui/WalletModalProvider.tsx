import React, { createContext, useContext, useState, useCallback } from 'react';

export interface WalletModalContextState {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  open: () => void;
  close: () => void;
}

export const WalletModalContext = createContext<WalletModalContextState | null>(null);

export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const contextValue: WalletModalContextState = {
    visible,
    setVisible,
    open,
    close,
  };

  return (
    <WalletModalContext.Provider value={contextValue}>
      {children}
    </WalletModalContext.Provider>
  );
}

export function useWalletModal(): WalletModalContextState {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error('useWalletModal must be used within a WalletModalProvider');
  }
  return context;
}

export function useOptionalWalletModal(): WalletModalContextState | null {
  const context = useContext(WalletModalContext);
  return context;
}
