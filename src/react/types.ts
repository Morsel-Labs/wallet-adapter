import React from 'react';
import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import { MorselCookieWalletAdapter, WalletReadyState, SignedMessageResponse, CookieWalletAdapter } from '../core';

export interface WalletContextState {
  wallet: CookieWalletAdapter;
  adapters: CookieWalletAdapter[];
  activeAdapter: CookieWalletAdapter;
  activeAdapterIndex: number;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  readyState: WalletReadyState;
  error: Error | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  selectAdapter(index: number): Promise<void>;
  signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
  signAllTransactions(transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]>;
  signMessage(message: Uint8Array): Promise<SignedMessageResponse>;
  sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<TransactionSignature>;
  refreshProvider(): void;
  clearError(): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

export interface WalletProviderProps {
  children: React.ReactNode;
  adapter?: CookieWalletAdapter;
  adapters?: CookieWalletAdapter[];
  autoConnect?: boolean;
  onError?: (error: Error) => void;
}
