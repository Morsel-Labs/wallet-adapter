// Core
export { MorselCookieWalletAdapter } from './core/MorselCookieWalletAdapter';
export { StandardWalletAdapter } from './core/StandardWalletAdapter';
export { COOKIE_CHAIN } from './core/chains';
export * from './core/types';
export * from './core/errors';
export { detectMorselCookieProvider, detectStandardMorselProvider } from './core/detect';
export * from './core/constants';
export type { CookieWalletAdapter } from './core/CookieWalletAdapter';

// Morsel Pay
export {
  morselPay, MorselPayError, checkoutIdOf, morselCheckoutUrl, payRpcUrl, MORSEL_PAY_API, MORSEL_PAY_CHECKOUT,
} from './core/pay';
export type {
  MorselPayOptions, MorselPayResult, MorselPayStatus, MorselPayErrorCode, MorselPayWallet, MorselCheckout,
} from './core/pay';

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
