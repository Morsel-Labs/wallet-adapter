import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';

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
  sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<TransactionSignature>;
  wcUri?: string;
  refreshProvider?(): void;
  destroy?(): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  once?(event: string, listener: (...args: any[]) => void): void;
  emit?(event: string, ...args: any[]): void;
}