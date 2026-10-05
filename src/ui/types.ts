import React from 'react';
import type { Connection } from '@solana/web3.js';

export interface ConnectButtonProps {
  /**
   * Custom content. With `children` or `className` the button keeps its original, unstyled
   * behaviour (you style it; clicking while connected disconnects).
   */
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Unstyled mode only: show the short address instead of `connectedLabel` when connected. */
  showAddress?: boolean;
  connectingLabel?: string;
  /** Unstyled mode only. */
  connectedLabel?: string;
  disconnectedLabel?: string;
  /**
   * Open the connect widget instead of connecting the active adapter directly. The styled button
   * uses the widget whenever a `WalletModalProvider` is present, unless this is explicitly `false`.
   */
  useModal?: boolean;
  onConnectError?: (error: Error) => void;
  onDisconnectError?: (error: Error) => void;

  // ---- styled button only ----
  theme?: 'dark' | 'light' | 'system' | 'auto';
  /** Any CSS colour; also settable with the `--mw-accent` CSS variable. */
  accentColor?: string;
  /** Pass a Connection to show the native balance in the account chip. */
  connection?: Connection | null;
  /** Symbol shown after the balance (default "COOK"). */
  balanceSymbol?: string;
  /** Show the Morsel mark on the connect button (default true). */
  showLogo?: boolean;
  size?: 'sm' | 'md';
  /** CSP nonce for the injected stylesheet. */
  nonce?: string;
}
