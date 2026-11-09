// Core and Morsel Pay (also importable alone, without React, from '@morsel-wallet/adapter/core')
export * from './core';

// React
export { WalletProvider } from './react/WalletProvider';
export { useWallet } from './react/useWallet';
export { WalletContext } from './react/WalletContext';
export * from './react/types';
export * from './react/constants';
export * from './react/hooks';

// UI
export { ConnectButton } from './ui/ConnectButton';
export { MorselPay } from './ui/MorselPay';
export type { MorselPayProps } from './ui/MorselPay';
export { WalletModal } from './ui/WalletModal';
export { WalletModalProvider, useWalletModal, useOptionalWalletModal } from './ui/WalletModalProvider';
export type { WalletModalContextState, WalletModalOpenOptions, WalletModalView } from './ui/WalletModalProvider';
export { getMorselConnectCss } from './ui/kit/styles';
export * from './ui/types';
export * from './ui/modalTypes';
