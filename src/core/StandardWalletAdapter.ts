import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import { CookieWalletAdapter } from './CookieWalletAdapter';
import { WalletConnectionError, WalletNotConnectedError, WalletSignTransactionError, WalletSignMessageError, WalletDisconnectionError } from './errors';

export class StandardWalletAdapter extends EventEmitter implements CookieWalletAdapter {
  readonly name: string;
  readonly url: string;
  readonly icon: string;
  publicKey: PublicKey | null = null;
  connected = false;
  connecting = false;
  readyState: 'Installed' | 'NotDetected' | 'Loadable' | 'Unsupported' = 'Installed';
  supportedTransactionVersions: ReadonlySet<'legacy' | 0> = new Set(['legacy', 0]);

  private _wallet: any;
  private _account: any = null;
  private _eventsCleanup: (() => void) | null = null;

  constructor(wallet: any) {
    super();
    this._wallet = wallet;
    this.name = String(wallet.name ?? 'Unknown Wallet');
    this.url = '';
    this.icon = typeof wallet.icon === 'string' ? wallet.icon : '';

    const eventsFeature = wallet.features?.['standard:events'];
    if (eventsFeature?.on) {
      const onChange = (properties: any) => {
        if ('accounts' in properties) this._syncAccounts();
      };
      eventsFeature.on('change', onChange);
      this._eventsCleanup = () => eventsFeature.off?.('change', onChange);
    }
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
      const walletError = error instanceof WalletConnectionError
        ? error
        : new WalletConnectionError(error instanceof Error ? error.message : 'Unknown error');
      this.emit('error', walletError);
      throw walletError;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const disconnectFeature = this._wallet.features?.['standard:disconnect'];
      if (disconnectFeature) await disconnectFeature.disconnect();
    } catch (error) {
      const walletError = new WalletDisconnectionError(error instanceof Error ? error.message : 'Unknown error');
      this.emit('error', walletError);
      throw walletError;
    } finally {
      this.publicKey = null;
      this.connected = false;
      this._account = null;
      this.emit('disconnect');
    }
  }

  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    if (!this.connected || !this._account) throw new WalletNotConnectedError();
    const signFeature = this._wallet.features?.['solana:signTransaction'];
    if (!signFeature) throw new WalletSignTransactionError('Wallet does not support solana:signTransaction');
    try {
      const isVersioned = transaction instanceof VersionedTransaction;
      const serialized = isVersioned
        ? transaction.serialize()
        : transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const chain = (this._account.chains?.[0] as string) ?? 'solana:mainnet';
      const results = await signFeature.signTransaction({ account: this._account, transaction: serialized, chain });
      const result = Array.isArray(results) ? results[0] : results;
      return isVersioned
        ? VersionedTransaction.deserialize(result.signedTransaction)
        : Transaction.from(result.signedTransaction);
    } catch (error) {
      const walletError = new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
      this.emit('error', walletError);
      throw walletError;
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
      const walletError = new WalletSignMessageError(error instanceof Error ? error.message : 'Unknown error');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const signed = await this.signTransaction(transaction);
    return connection.sendRawTransaction(signed.serialize(), options);
  }

  destroy(): void {
    this._eventsCleanup?.();
    this.removeAllListeners();
    this.publicKey = null;
    this.connected = false;
    this._account = null;
  }
}
