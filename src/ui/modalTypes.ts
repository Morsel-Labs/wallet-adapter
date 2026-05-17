import React from 'react';

export interface WalletModalProps {
  className?: string;
  overlayClassName?: string;
  variant?: 'headless' | 'premium';
  theme?: 'dark' | 'light' | 'system';
  title?: string;
  subtitle?: string;
  logo?: React.ReactNode;
  showPoweredBy?: boolean;
  networks?: Array<{
    id: string;
    name: string;
    icon?: string;
  }>;
  selectedNetworkId?: string;
  onNetworkChange?: (networkId: string) => void;
  mobileDeepLink?: string;
  connectLabel?: string;
  closeLabel?: string;
  installLabel?: string;
  onConnectError?: (error: Error) => void;
}

