import { useWallet } from '../useWallet';
import { MORSEL_WALLET_AUTO_CONNECT_KEY } from '../constants';

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

export function useAutoConnect() {
  const wallet = useWallet();

  const enableAutoConnect = async (): Promise<void> => {
    setAutoConnect(true);
    if (!wallet.connected && !wallet.connecting) {
      await wallet.connect();
    }
  };

  const disableAutoConnect = (): void => {
    setAutoConnect(false);
  };

  const isAutoConnectEnabled = (): boolean => {
    return getAutoConnect();
  };

  return { enableAutoConnect, disableAutoConnect, isAutoConnectEnabled };
}
