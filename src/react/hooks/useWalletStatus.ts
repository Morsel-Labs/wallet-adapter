import { useWallet } from '../useWallet';

export function useWalletStatus() {
  const wallet = useWallet();
  return {
    publicKey: wallet.publicKey,
    connected: wallet.connected,
    connecting: wallet.connecting,
    readyState: wallet.readyState,
    wallet: wallet.wallet,
  };
}
