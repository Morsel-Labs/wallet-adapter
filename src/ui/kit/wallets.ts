import type { CookieWalletAdapter } from '../../core/CookieWalletAdapter';
import type { SvmChain } from '../../core/chains';
import { walletSupportsChain } from '../../core/support';
import { isMorselAdapterName } from './env';

export interface WalletEntry {
  a: CookieWalletAdapter;
  /** Its index in useWallet().adapters (what selectAdapter takes). */
  i: number;
}

export interface ChainWallets {
  /** Morsel's index in the adapter list, or -1. Morsel is always offered: it works on every network. */
  morselIndex: number;
  /** The other wallets that work on the network, installed first. */
  others: WalletEntry[];
  /** Of those, the installed ones. */
  detected: WalletEntry[];
  /** Installed wallets left out because they do not advertise the network. */
  unsupported: WalletEntry[];
}

/**
 * Which wallets the connect widget offers on `chain`: Morsel always, and every other wallet only if it
 * advertises the network (a wallet that does not say which networks it has is taken at its word).
 * No chain (outside a WalletProvider): everything, as before.
 */
export function walletsForChain(adapters: CookieWalletAdapter[], chain: SvmChain | null | undefined): ChainWallets {
  const morselIndex = adapters.findIndex((a) => isMorselAdapterName(a.name));
  const all = adapters.map((a, i) => ({ a, i })).filter((x) => x.i !== morselIndex);
  const fits = (x: WalletEntry) => !chain || walletSupportsChain(x.a, chain);
  const installed = (x: WalletEntry) => x.a.readyState === 'Installed';
  const others = all.filter(fits).sort((x, y) => Number(installed(y)) - Number(installed(x)));
  return {
    morselIndex,
    others,
    detected: others.filter(installed),
    unsupported: all.filter((x) => installed(x) && !fits(x)),
  };
}
