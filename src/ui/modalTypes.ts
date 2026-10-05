import React from 'react';

export interface MorselStoreLinks {
  /** Morsel's install page; every other link falls back to it. */
  install?: string;
  ios?: string;
  android?: string;
  /** Browser extension. */
  extension?: string;
  /** "Learn more" link in the Get Morsel card. */
  website?: string;
}

export interface WalletModalProps {
  /** Extra class on the widget card (compact) / replaces the card styles (headless). */
  className?: string;
  /** Extra class on the backdrop (compact) / replaces the backdrop styles (headless). */
  overlayClassName?: string;
  /**
   * `compact` (default): the Morsel connect widget.
   * `premium`: kept for backward compatibility; renders the compact widget.
   * `headless`: the bare, unstyled list (bring your own CSS).
   */
  variant?: 'compact' | 'premium' | 'headless';
  /** `system` follows the OS setting live. `auto` is an alias of `system`. */
  theme?: 'dark' | 'light' | 'system' | 'auto';
  /** Title of the wallet list. */
  title?: string;
  /** Optional line under the title of the wallet list. */
  subtitle?: string;
  /** Your dApp's logo (URL), shown next to the title and on the approval screen. */
  logo?: React.ReactNode;
  showPoweredBy?: boolean;
  /** When given, a small network switch is shown on the wallet list. */
  networks?: Array<{
    id: string;
    name: string;
    icon?: string;
  }>;
  selectedNetworkId?: string;
  onNetworkChange?: (networkId: string) => void;
  /** Override the "Open in Morsel" link on phones (default: Morsel's universal browse link). */
  mobileDeepLink?: string;
  /** Label of the Morsel connect action. */
  connectLabel?: string;
  closeLabel?: string;
  /** Label for wallets that are not installed (compact default: "Get"). */
  installLabel?: string;
  onConnectError?: (error: Error) => void;

  // ---- compact widget only ----
  /** Accent colour (any CSS colour). Also settable with the `--mw-accent` CSS variable. */
  accentColor?: string;
  /** `center` (default) or `anchor`: drop down from the element that opened it (desktop). */
  placement?: 'center' | 'anchor';
  /** Close by itself a moment after a successful connection (default true). */
  autoClose?: boolean;
  /** Inside Morsel's in-app browser, connect straight away instead of showing the list (default true). */
  autoConnectInMorsel?: boolean;
  /** Where the "Get Morsel" surfaces point. Defaults to Morsel's install page. */
  links?: MorselStoreLinks;
  /** z-index of the widget layer (default 2147483000). */
  zIndex?: number;
  /** CSP nonce for the injected stylesheet. */
  nonce?: string;
}
