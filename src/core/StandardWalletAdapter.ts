import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import bs58 from 'bs58';
import { CookieWalletAdapter } from './CookieWalletAdapter';
import { resolveSvmChain, connectionFor, type SvmChain } from './chains';
import { chainIdFor } from './support';
import type { ChainSendOptions } from './types';
import {
  WalletAdapterError, WalletConnectionError, WalletNotConnectedError, WalletSignTransactionError, WalletSignMessageError,
  WalletDisconnectionError, WalletSendTransactionError, WalletChainNotSupportedError,
} from './errors';

/**
 * Any Wallet Standard wallet (Phantom, Backpack, Solflare, …) as an adapter. Every signature request
 * names the network (`chain`): the id of the adapter's chain the wallet advertises. A wallet that does
 * not advertise the network is refused before anything reaches it.
 */
export class StandardWalletAdapter extends EventEmitter implements CookieWalletAdapter {
  readonly name: string;
  readonly url: string;
  readonly icon: string;
  publicKey: PublicKey | null = null;
  connected = false;
  connecting = false;
  readyState: 'Installed' | 'NotDetected' | 'Loadable' | 'Unsupported' = 'Installed';
  supportedTransactionVersions: ReadonlySet<'legacy' | 0> = new Set(['legacy', 0]);
  /** The network requests are signed for; null: the account's first chain (0.3 behaviour). */
  chain: SvmChain | null = null;
  /** Your RPC for `chain`, used when the wallet cannot send itself (see signAndSendTransaction). */
  rpcUrl: string | undefined = undefined;

  private _wallet: any;
  private _account: any = null;
  private _eventsCleanup: (() => void) | null = null;

  constructor(wallet: any, chain?: SvmChain | string | null) {
    super();
    this._wallet = wallet;
    this.name = String(wallet.name ?? 'Unknown Wallet');
    this.url = '';
    this.icon = typeof wallet.icon === 'string' ? wallet.icon : '';
    if (chain) this.chain = resolveSvmChain(chain);

    const eventsFeature = wallet.features?.['standard:events'];
    if (eventsFeature?.on) {
      const onChange = (properties: any) => {
        if ('accounts' in properties) this._syncAccounts();
      };
      const off = eventsFeature.on('change', onChange);
      this._eventsCleanup = () => (typeof off === 'function' ? off() : eventsFeature.off?.('change', onChange));
    }
  }

  /** The chain ids the wallet advertises. */
  get chains(): readonly string[] {
    const chains = this._wallet.chains;
    return Array.isArray(chains) ? chains : [];
  }

  setChain(chain: SvmChain | string | null, rpcUrl?: string): void {
    this.chain = chain ? resolveSvmChain(chain) : null;
    this.rpcUrl = rpcUrl;
  }

  /** The id to sign `chain` for with this wallet; throws when the wallet does not support it. */
  private _chainId(chain: SvmChain | null): string {
    if (!chain) {
      // No network set (an adapter used on its own, as in 0.3): the account's first chain.
      return (this._account?.chains?.[0] as string) ?? this.chains[0] ?? 'solana:mainnet';
    }
    const advertised = [...this.chains, ...((this._account?.chains as string[] | undefined) ?? [])];
    const id = chainIdFor(advertised, chain);
    if (!id) throw new WalletChainNotSupportedError(`${this.name} does not support ${chain.name}`);
    return id;
  }

  private _fail<E extends WalletAdapterError>(error: unknown, ErrorType: new (m: string) => E): WalletAdapterError {
    const walletError = error instanceof WalletAdapterError
      ? error
      : new ErrorType(error instanceof Error ? error.message : 'Unknown error');
    this.emit('error', walletError);
    return walletError;
  }

  private _syncAccounts(): void {
    const accounts = this._wallet.accounts;
    if (!accounts?.length) {
      if (this.connected) {
        this.publicKey = null;
        this.connected = false;
        this._account = null;
        this.emit('disconnect');
      }
    } else {
      try {
        const account = accounts[0];
        const pk = new PublicKey(account.address);
        this._account = account;
        this.publicKey = pk;
        if (!this.connected) {
          this.connected = true;
          this.emit('connect', pk);
        }
      } catch {
        // invalid address
      }
    }
  }

  async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const connectFeature = this._wallet.features?.['standard:connect'];
      if (!connectFeature) throw new WalletConnectionError('Wallet does not support standard:connect');
      const result = await connectFeature.connect({ silent: false });
      const accounts = result?.accounts ?? this._wallet.accounts ?? [];
      if (!accounts.length) throw new WalletConnectionError('No accounts returned from wallet');
      const account = accounts[0];
      this._account = account;
      const pk = new PublicKey(account.address);
      this.publicKey = pk;
      this.connected = true;
      this.emit('connect', pk);
    } catch (error) {
      throw this._fail(error, WalletConnectionError);
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const disconnectFeature = this._wallet.features?.['standard:disconnect'];
      if (disconnectFeature) await disconnectFeature.disconnect();
    } catch (error) {
      throw this._fail(error, WalletDisconnectionError);
    } finally {
      this.publicKey = null;
      this.connected = false;
      this._account = null;
      this.emit('disconnect');
    }
  }

  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    return this._sign(transaction, this.chain);
  }

  private async _sign(transaction: Transaction | VersionedTransaction, chain: SvmChain | null): Promise<Transaction | VersionedTransaction> {
    if (!this.connected || !this._account) throw new WalletNotConnectedError();
    try {
      const signFeature = this._wallet.features?.['solana:signTransaction'];
      if (!signFeature) throw new WalletSignTransactionError('Wallet does not support solana:signTransaction');
      const chainId = this._chainId(chain);
      const isVersioned = transaction instanceof VersionedTransaction;
      const serialized = isVersioned
        ? transaction.serialize()
        : transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const results = await signFeature.signTransaction({ account: this._account, transaction: serialized, chain: chainId });
      const result = Array.isArray(results) ? results[0] : results;
      return isVersioned
        ? VersionedTransaction.deserialize(result.signedTransaction)
        : Transaction.from(result.signedTransaction);
    } catch (error) {
      throw this._fail(error, WalletSignTransactionError);
    }
  }

  async signAllTransactions(transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]> {
    return Promise.all(transactions.map(tx => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    if (!this.connected || !this._account) throw new WalletNotConnectedError();
    const signFeature = this._wallet.features?.['solana:signMessage'];
    if (!signFeature) throw new WalletSignMessageError('Wallet does not support solana:signMessage');
    try {
      const results = await signFeature.signMessage({ account: this._account, message });
      const result = Array.isArray(results) ? results[0] : results;
      return { signature: result.signature };
    } catch (error) {
      throw this._fail(error, WalletSignMessageError);
    }
  }

  /** Signs for the adapter's network (or `options.chain`), then sends through your `connection`. */
  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: ChainSendOptions
  ): Promise<TransactionSignature> {
    const { chain, ...send } = options ?? {};
    const signed = await this._sign(transaction, chain ? resolveSvmChain(chain) : this.chain);
    return connection.sendRawTransaction(signed.serialize(), send as SendOptions);
  }

  /**
   * The wallet signs and broadcasts on the adapter's network (or `options.chain`), through
   * `solana:signAndSendTransaction`. A wallet without that feature signs, and the transaction is sent
   * through the network's public endpoint.
   */
  async signAndSendTransaction(transaction: Transaction | VersionedTransaction, options?: ChainSendOptions): Promise<TransactionSignature> {
    const { chain: override, ...send } = options ?? {};
    const chain = override ? resolveSvmChain(override) : this.chain;
    const feature = this._wallet.features?.['solana:signAndSendTransaction'];
    if (!feature) {
      if (!chain) throw this._fail(new WalletSendTransactionError('No network to send on: set the adapter\'s chain'), WalletSendTransactionError);
      const signed = await this._sign(transaction, chain);
      try {
        return await connectionFor(chain, chain.id === this.chain?.id ? this.rpcUrl : undefined).sendRawTransaction(signed.serialize(), send as SendOptions);
      } catch (error) {
        throw this._fail(error, WalletSendTransactionError);
      }
    }
    if (!this.connected || !this._account) throw new WalletNotConnectedError();
    try {
      const chainId = this._chainId(chain);
      const bytes = transaction instanceof VersionedTransaction
        ? transaction.serialize()
        : transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const results = await feature.signAndSendTransaction({ account: this._account, transaction: bytes, chain: chainId, options: send });
      const result = Array.isArray(results) ? results[0] : results;
      const signature = result?.signature;
      if (signature instanceof Uint8Array) return bs58.encode(signature);
      if (typeof signature === 'string') return signature;
      throw new WalletSendTransactionError('The wallet returned no signature');
    } catch (error) {
      throw this._fail(error, WalletSendTransactionError);
    }
  }

  destroy(): void {
    this._eventsCleanup?.();
    this.removeAllListeners();
    this.publicKey = null;
    this.connected = false;
    this._account = null;
  }
}
