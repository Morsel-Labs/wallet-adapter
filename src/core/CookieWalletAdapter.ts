import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import type { SvmChain } from './chains';
import type { ChainSendOptions } from './types';

export interface CookieWalletAdapter {
  name: string;
  url: string;
  icon: string;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  readyState: 'Installed' | 'NotDetected' | 'Loadable' | 'Unsupported';
  supportedTransactionVersions: ReadonlySet<'legacy' | 0>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
  signAllTransactions(transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  /** Signs for the adapter's network (or `options.chain`), then sends through `connection`. */
  sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions | ChainSendOptions
  ): Promise<TransactionSignature>;
  /** Asks the wallet to sign and broadcast on the adapter's network (or `options.chain`). */
  signAndSendTransaction?(transaction: Transaction | VersionedTransaction, options?: ChainSendOptions): Promise<TransactionSignature>;
  /** The network the adapter signs for; null until one is set (then the wallet's own network applies). */
  chain?: SvmChain | null;
  /**
   * Set the network the adapter signs for, and optionally your RPC for it (WalletProvider does this).
   * Throws for an unknown network.
   */
  setChain?(chain: SvmChain | string | null, rpcUrl?: string): void;
  /** The chain ids the wallet advertises (Wallet Standard wallets); absent when unknown. */
  readonly chains?: readonly string[];
  wcUri?: string;
  refreshProvider?(): void;
  destroy?(): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  once?(event: string, listener: (...args: any[]) => void): void;
  emit?(event: string, ...args: any[]): void;
}