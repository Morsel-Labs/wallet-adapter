import { PublicKey, Transaction, VersionedTransaction, SendOptions } from '@solana/web3.js';
import type { SvmChain } from './chains';

/** The shape of COOKIE_CHAIN (kept from 0.1; new code uses SvmChain). */
export interface CookieChainConfig {
  name: string;
  chainId: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
}

export interface MorselCookieProvider {
  isMorsel?: boolean;
  isDumpSack?: boolean;
  publicKey?: PublicKey | string | null;
  isConnected?: boolean;
  connect(): Promise<{ publicKey?: PublicKey | string } | PublicKey | string | void>;
  disconnect?(): Promise<void>;
  /** `network`: the chain id to sign for (the wallet refuses a transaction for another network). */
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T, network?: string): Promise<T>;
  signAllTransactions?<T extends Transaction | VersionedTransaction>(transactions: T[], network?: string): Promise<T[]>;
  /** Sign and broadcast on `network` through the wallet's own node. */
  signAndSendTransaction?(
    transaction: Transaction | VersionedTransaction,
    network?: string | SendOptions,
    options?: SendOptions
  ): Promise<{ signature: string } | string>;
  signMessage?(message: Uint8Array): Promise<Uint8Array | { signature: Uint8Array | number[] | string; signedMessage?: Uint8Array | number[] | string }>;
  on?(event: 'accountChanged', listener: (publicKey: PublicKey | string | null) => void): void;
  off?(event: 'accountChanged', listener: (publicKey: PublicKey | string | null) => void): void;
}

export type WalletReadyState = 'Installed' | 'NotDetected' | 'Loadable' | 'Unsupported';

export type WalletAdapterEvents = 'connect' | 'disconnect' | 'error' | 'readyStateChange';

/**
 * Where the QR / relay pairing with the Morsel mobile app stands.
 *  - `idle`      no relay session (server side, or destroyed)
 *  - `waiting`   QR is live, nobody has scanned it yet
 *  - `scanned`   the phone scanned it and is showing the approval prompt
 *  - `rejected`  the user declined in the app (a fresh session follows shortly)
 *  - `connected` approved; the relay channel is live
 */
export type MorselRelayStatus = 'idle' | 'waiting' | 'scanned' | 'rejected' | 'connected';

export interface SignedMessageResponse {
  /** 64-byte ed25519 signature by the connected account, verified by the adapter before it is returned. */
  signature: Uint8Array;
  /**
   * Set only when the wallet signed an off-chain message envelope that carries your message (a hardware
   * wallet). The signature is over these bytes: verify against them, not against the raw message.
   */
  signedMessage?: Uint8Array;
}

/** sendTransaction / signAndSendTransaction options: web3.js SendOptions, plus the network to sign for. */
export interface ChainSendOptions extends SendOptions {
  /**
   * Sign for this network instead of the adapter's current one (a key, chain id, or SvmChain). The
   * transaction must belong to it: the wallet refuses one built for another network.
   */
  chain?: SvmChain | string;
}
