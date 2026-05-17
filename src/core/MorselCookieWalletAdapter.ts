import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { MorselCookieProvider, WalletReadyState, SignedMessageResponse } from './types';
import { WalletAdapterError, WalletNotFoundError, WalletNotConnectedError, WalletConnectionError, WalletDisconnectionError, WalletSignTransactionError, WalletSignMessageError } from './errors';
import { detectMorselCookieProvider } from './detect';
import { MORSEL_COOKIE_WALLET_NAME, MORSEL_COOKIE_WALLET_URL, MORSEL_COOKIE_WALLET_ICON } from './constants';
import { CookieWalletAdapter } from './CookieWalletAdapter';

const RELAY_BASE = 'wss://api.dumpsack.xyz';


function toBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(nacl.randomBytes(32)).map(b => chars[b % 62]).join('');
}

function generateRequestId(): string {
  return Array.from(nacl.randomBytes(16)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function encrypt(msg: object, theirPubKey: Uint8Array, mySecretKey: Uint8Array): string {
  const nonce = nacl.randomBytes(24);
  const plaintext = new TextEncoder().encode(JSON.stringify(msg));
  const ciphertext = nacl.box(plaintext, nonce, theirPubKey, mySecretKey);
  const combined = new Uint8Array(24 + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, 24);
  return Buffer.from(combined).toString('base64');
}

function decrypt(payload: string, theirPubKey: Uint8Array, mySecretKey: Uint8Array): any {
  const combined = new Uint8Array(Buffer.from(payload, 'base64'));
  const nonce = combined.slice(0, 24);
  const ciphertext = combined.slice(24);
  const plaintext = nacl.box.open(ciphertext, nonce, theirPubKey, mySecretKey);
  if (!plaintext) throw new Error('Decryption failed');
  return JSON.parse(new TextDecoder().decode(plaintext));
}


type PendingRequest = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
};

type SessionCallbacks = {
  onApprove: (walletAddress: string) => void;
  onReject: () => void;
  onClose: (wasConnected: boolean) => void;
};

class MorselRelaySession {
  readonly sessionId: string;
  readonly uri: string;
  connected = false;
  closed = false;

  private keyPair: nacl.BoxKeyPair;
  private ws: WebSocket | null = null;
  private walletPubKey: Uint8Array | null = null;
  private proposalId: string | null = null;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor() {
    this.keyPair = nacl.box.keyPair();
    this.sessionId = generateSessionId();
    const k = toBase64url(this.keyPair.publicKey);
    const r = encodeURIComponent(RELAY_BASE);
    this.uri = `morsel://connect?s=${this.sessionId}&k=${k}&r=${r}`;
  }

  start(cb: SessionCallbacks): void {
    if (this.closed) return;

    this.ws = new WebSocket(`${RELAY_BASE}/relay/${this.sessionId}?role=dapp`);

    this.ws.onmessage = (event) => {
      if (this.closed) return;
      let msg: any;
      try { msg = JSON.parse(event.data as string); } catch { return; }

      if (msg.type === 'peer_disconnected' && msg.role === 'wallet') {
        if (this.connected) cb.onClose(true);

      } else if (msg.type === 'wallet_hello' && !this.walletPubKey) {
        try {
          this.walletPubKey = fromBase64url(msg.pubkey);
          this.proposalId = generateRequestId();
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const name = typeof document !== 'undefined' ? (document.title || window.location.hostname) : 'dApp';
          const icon = origin ? `${origin}/favicon.ico` : '';
          this._sendEncrypted({ type: 'session_proposal', id: this.proposalId, metadata: { name, icon, origin } });
        } catch { /* ignore malformed hello */ }

      } else if (msg.type === 'enc' && this.walletPubKey) {
        try {
          const dec = decrypt(msg.payload, this.walletPubKey, this.keyPair.secretKey);
          this._handleDecrypted(dec, cb);
        } catch { /* ignore decryption failures */ }
      }
    };

    this.ws.onclose = () => {
      if (this.closed) return;
      this._rejectAllPending('Connection closed');
      cb.onClose(this.connected);
    };

    this.ws.onerror = () => { /* relay errors handled via onclose */ };
  }

  private _handleDecrypted(msg: any, cb: SessionCallbacks): void {
    switch (msg.type) {
      case 'session_approve':
        if (msg.id === this.proposalId) {
          this.connected = true;
          cb.onApprove(msg.walletAddress);
        }
        break;

      case 'session_reject':
        if (msg.id === this.proposalId) cb.onReject();
        break;

      case 'sign_result': {
        const p = this.pendingRequests.get(msg.id);
        if (p) { clearTimeout(p.timerId); this.pendingRequests.delete(msg.id); p.resolve(msg); }
        break;
      }

      case 'sign_reject': {
        const p = this.pendingRequests.get(msg.id);
        if (p) { clearTimeout(p.timerId); this.pendingRequests.delete(msg.id); p.reject(new Error(msg.message || 'User rejected')); }
        break;
      }

      case 'wallet_disconnect':
        cb.onClose(true);
        break;
    }
  }

  sendRequest(msg: Record<string, unknown> & { id: string }, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.walletPubKey) { reject(new Error('Not connected')); return; }
      const id = (msg as any).id;
      const timerId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timed out'));
      }, timeoutMs);
      this.pendingRequests.set(id, { resolve, reject, timerId });
      this._sendEncrypted(msg);
    });
  }

  private _sendEncrypted(msg: object): void {
    if (!this.walletPubKey || this.ws?.readyState !== WebSocket.OPEN) return;
    const payload = encrypt(msg, this.walletPubKey, this.keyPair.secretKey);
    this.ws!.send(JSON.stringify({ type: 'enc', payload }));
  }

  private _rejectAllPending(reason: string): void {
    for (const [id, p] of this.pendingRequests) {
      clearTimeout(p.timerId);
      p.reject(new Error(reason));
      this.pendingRequests.delete(id);
    }
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.connected && this.walletPubKey) {
      try { this._sendEncrypted({ type: 'session_end' }); } catch { /* ignore */ }
    }
    this._rejectAllPending('Session ended');
    this.ws?.close();
  }
}


type AdapterEvents = {
  connect: (publicKey: PublicKey) => void;
  disconnect: () => void;
  error: (error: WalletAdapterError) => void;
  readyStateChange: (readyState: WalletReadyState) => void;
  wcUriChange: (uri: string) => void;
};


export class MorselCookieWalletAdapter extends EventEmitter<AdapterEvents> implements CookieWalletAdapter {
  name = MORSEL_COOKIE_WALLET_NAME;
  url = MORSEL_COOKIE_WALLET_URL;
  icon = MORSEL_COOKIE_WALLET_ICON;
  publicKey: PublicKey | null = null;
  connected = false;
  connecting = false;
  readyState: WalletReadyState = 'NotDetected';
  supportedTransactionVersions: ReadonlySet<'legacy' | 0> = new Set(['legacy', 0]);
  wcUri = '';

  private provider: MorselCookieProvider | null = null;
  private connectPromise: Promise<void> | null = null;
  private relaySession: MorselRelaySession | null = null;
  private relayConnected = false;
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  private accountChangedListener = (pk: PublicKey | string | null) => this._handleAccountChanged(pk);
  private windowAccountChangedListener = (event: Event) => {
    this._handleAccountChanged((event as CustomEvent).detail);
  };

  constructor() {
    super();
    this.autoDetect();
    this.refreshIntervalId = setInterval(() => this.refreshProvider(), 1000);
    if (typeof window !== 'undefined') this._startRelaySession();
  }


  private _startRelaySession(): void {
    this.relaySession?.end();
    const session = new MorselRelaySession();
    this.relaySession = session;
    this.wcUri = session.uri;
    this.emit('wcUriChange', session.uri);

    session.start({
      onApprove: (walletAddress) => {
        try {
          const pk = new PublicKey(walletAddress);
          this.publicKey = pk;
          this.connected = true;
          this.relayConnected = true;
          if (this.readyState !== 'Installed') {
            this.readyState = 'Installed';
            this.emit('readyStateChange', this.readyState);
          }
          this.emit('connect', pk);
        } catch { /* ignore invalid address */ }
      },
      onReject: () => {
        setTimeout(() => this._startRelaySession(), 500);
      },
      onClose: (wasConnected) => {
        this.relayConnected = false;
        if (wasConnected && !this.provider) {
          this.publicKey = null;
          this.connected = false;
          this.emit('disconnect');
        }
        if (!session.closed) {
          setTimeout(() => this._startRelaySession(), 500);
        }
      },
    });
  }


  refreshProvider(): void {
    const newProvider = detectMorselCookieProvider();
    const wasDetected = this.provider !== null;
    const isDetected = newProvider !== null;
    this.provider = newProvider;
    if (wasDetected !== isDetected) {
      this.readyState = isDetected ? 'Installed' : (this.relayConnected ? 'Installed' : 'NotDetected');
      this.emit('readyStateChange', this.readyState);
    }
  }

  autoDetect(): void {
    if (typeof window === 'undefined') {
      this.readyState = 'Unsupported';
    } else {
      this.refreshProvider();
    }
  }

  private _handleAccountChanged(publicKey: PublicKey | string | null): void {
    if (publicKey === null) {
      this.publicKey = null;
      this.connected = false;
      this.emit('disconnect');
    } else {
      let pk: PublicKey;
      if (publicKey instanceof PublicKey) {
        pk = publicKey;
      } else if (typeof publicKey === 'string') {
        try { pk = new PublicKey(publicKey); } catch { return; }
      } else {
        return;
      }
      this.publicKey = pk;
      this.emit('connect', pk);
    }
  }



  async connect(): Promise<void> {
    if (this.relayConnected && !this.provider) return;

    if (this.connecting) {
      if (this.connectPromise) return this.connectPromise;
      throw new WalletConnectionError('Already connecting');
    }
    this.connecting = true;
    this.connectPromise = this._connectInjected();
    try {
      await this.connectPromise;
    } finally {
      this.connecting = false;
      this.connectPromise = null;
    }
  }

  private async _connectInjected(): Promise<void> {
    this.refreshProvider();
    if (!this.provider) {
      const error = new WalletNotFoundError();
      this.emit('error', error);
      throw error;
    }
    try {
      const result = await this.provider.connect();

      const tryPk = (value: unknown): PublicKey | null => {
        if (!value) return null;
        if (value instanceof PublicKey) return value;
        try { return new PublicKey(value as any); } catch { return null; }
      };

      let publicKey: PublicKey | null = null;
      if (result && typeof result === 'object') {
        const r = result as any;
        if ('publicKey' in r) publicKey = tryPk(r.publicKey);
        if (!publicKey && Array.isArray(r.accounts) && r.accounts.length > 0) {
          const acc = r.accounts[0];
          publicKey = tryPk(acc.address) ?? tryPk(acc.publicKey);
        }
      } else {
        publicKey = tryPk(result);
      }

      if (!publicKey) {
        const p = this.provider as any;
        publicKey = tryPk(p.publicKey) ?? tryPk(p.accounts?.[0]?.address) ?? tryPk(p.accounts?.[0]?.publicKey);
      }

      if (!publicKey) throw new WalletConnectionError('Invalid publicKey response');
      this.publicKey = publicKey;
      this.connected = true;
      if (this.provider.on && this.provider.off) {
        this.provider.on('accountChanged', this.accountChangedListener);
      }
      if (typeof window !== 'undefined' && (window as any).dumpsack) {
        window.addEventListener('accountChanged', this.windowAccountChangedListener);
      }
      this.emit('connect', publicKey);
    } catch (error) {
      const walletError = error instanceof WalletAdapterError ? error : new WalletConnectionError(error instanceof Error ? error.message : 'Unknown error');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  async disconnect(): Promise<void> {
    if (this.relayConnected && this.relaySession) {
      this.relaySession.end();
      this.relayConnected = false;
      this._startRelaySession();
    }

    if (this.provider) {
      try {
        if (this.provider.disconnect) await this.provider.disconnect();
        if (this.provider.off) this.provider.off('accountChanged', this.accountChangedListener);
        if (typeof window !== 'undefined') window.removeEventListener('accountChanged', this.windowAccountChangedListener);
      } catch (error) {
        const walletError = new WalletDisconnectionError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    this.publicKey = null;
    this.connected = false;
    this.emit('disconnect');
  }



  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    if (this.provider) {
      if (!this.connected) throw new WalletNotConnectedError();
      try {
        return await this.provider.signTransaction(transaction);
      } catch (error) {
        const walletError = new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    if (this.relayConnected && this.relaySession) {
      try {
        const isVersioned = transaction instanceof VersionedTransaction;
        const bytes = isVersioned
          ? transaction.serialize()
          : transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
        const id = generateRequestId();
        const result = await this.relaySession.sendRequest(
          { type: 'sign_transaction', id, transaction: Buffer.from(bytes).toString('base64') },
          60_000
        );
        const signed = Buffer.from(result.transaction, 'base64') as unknown as Uint8Array;
        return isVersioned ? VersionedTransaction.deserialize(signed) : Transaction.from(signed as any);
      } catch (error) {
        const walletError = new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    throw new WalletNotConnectedError();
  }

  async signAllTransactions(transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]> {
    if (!this.connected) throw new WalletNotConnectedError();
    if (this.provider?.signAllTransactions) {
      try {
        return await this.provider.signAllTransactions(transactions);
      } catch (error) {
        const walletError = new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }
    return Promise.all(transactions.map(tx => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array): Promise<SignedMessageResponse> {
    if (this.provider) {
      if (!this.connected) throw new WalletNotConnectedError();
      if (!this.provider.signMessage) throw new WalletSignMessageError('Sign message not supported');
      try {
        const result = await this.provider.signMessage(message);
        let signature: Uint8Array;
        if (result instanceof Uint8Array) {
          signature = result;
        } else if (Array.isArray(result) && result.every(x => typeof x === 'number')) {
          signature = new Uint8Array(result);
        } else if (typeof result === 'string') {
          signature = Uint8Array.from(Buffer.from(result, 'base64'));
        } else if (result && typeof result === 'object' && 'signature' in result) {
          const sig = (result as any).signature;
          if (sig instanceof Uint8Array) signature = sig;
          else if (Array.isArray(sig)) signature = new Uint8Array(sig);
          else if (typeof sig === 'string') signature = Uint8Array.from(Buffer.from(sig, 'base64'));
          else throw new WalletSignMessageError('Unsupported signature format');
        } else {
          throw new WalletSignMessageError('Invalid signature response');
        }
        return { signature };
      } catch (error) {
        const walletError = error instanceof WalletAdapterError ? error : new WalletSignMessageError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    if (this.relayConnected && this.relaySession) {
      try {
        const id = generateRequestId();
        const result = await this.relaySession.sendRequest(
          { type: 'sign_message', id, message: Buffer.from(message).toString('base64') },
          60_000
        );
        return { signature: bs58.decode(result.signature) as unknown as Uint8Array };
      } catch (error) {
        const walletError = error instanceof WalletAdapterError ? error : new WalletSignMessageError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    throw new WalletNotConnectedError();
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const signed = await this.signTransaction(transaction);
    return await connection.sendRawTransaction(signed.serialize(), options);
  }



  destroy(): void {
    if (this.refreshIntervalId !== null) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
    this.removeAllListeners();
    if (this.provider?.off) this.provider.off('accountChanged', this.accountChangedListener);
    if (typeof window !== 'undefined') window.removeEventListener('accountChanged', this.windowAccountChangedListener);
    this.relaySession?.end();
    this.relaySession = null;
    this.provider = null;
    this.publicKey = null;
    this.connected = false;
    this.connecting = false;
    this.relayConnected = false;
  }
}
