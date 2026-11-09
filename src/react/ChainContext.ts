import { createContext } from 'react';
import type { Connection } from '@solana/web3.js';
import type { SvmChain } from '../core/chains';

export interface ChainContextState {
  /** The network the app is on. Every signature request names it to the wallet. */
  chain: SvmChain;
  /** The networks the app offers (WalletProvider `chains`); just `chain` when none were given. */
  chains: SvmChain[];
  /**
   * Move the app to another network, by key or id. Throws for an unknown one, or for one outside
   * `chains` when WalletProvider was given `chains`.
   */
  setChain(key: string): void;
  /** A Connection to `chain` for reads: WalletProvider's `rpcUrl` for it, else its public endpoint. */
  connection: Connection;
}

export const ChainContext = createContext<ChainContextState | null>(null);
