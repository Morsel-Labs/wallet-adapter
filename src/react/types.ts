import React from 'react';
import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import { WalletReadyState, SignedMessageResponse, CookieWalletAdapter, ChainSendOptions } from '../core';
import type { SvmChain } from '../core/chains';

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
  /** Signs for the app's network (or `options.chain`), then sends through `connection`. */
  sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions | ChainSendOptions
  ): Promise<TransactionSignature>;
  /**
   * The wallet signs and broadcasts on the app's network (or `options.chain`). A wallet that cannot
   * signs, and the transaction goes out through useChain().connection.
   */
  signAndSendTransaction(transaction: Transaction | VersionedTransaction, options?: ChainSendOptions): Promise<TransactionSignature>;
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
  /**
   * The app's network: a key ('fogo'), a chain id, or an SvmChain (default 'solana'). Every signature
   * request names it to the wallet. Changing the prop moves the app; an unknown network throws.
   */
  chain?: string | SvmChain;
  /** The networks the app offers (setChain is limited to them). Default: any network, starting at `chain`. */
  chains?: Array<string | SvmChain>;
  /**
   * Your RPC for reads (useChain().connection, useWalletBalance). A string is for the `chain` network
   * only; a record by key ({ fogo: '…', solana: '…' }) or a function covers several. Networks left out
   * use their public endpoint.
   */
  rpcUrl?: string | Record<string, string> | ((chain: SvmChain) => string | undefined);
  /** Called when the app's network changes (setChain or a new `chain` prop). */
  onChainChange?: (chain: SvmChain) => void;
}
