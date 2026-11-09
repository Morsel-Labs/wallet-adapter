import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

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
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions?<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
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
