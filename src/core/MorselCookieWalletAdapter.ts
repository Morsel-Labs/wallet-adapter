import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions, TransactionSignature } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { MorselCookieProvider, WalletReadyState, SignedMessageResponse, MorselRelayStatus } from './types';
import { WalletAdapterError, WalletNotFoundError, WalletNotConnectedError, WalletConnectionError, WalletDisconnectionError, WalletSignTransactionError, WalletSignMessageError } from './errors';
import { detectMorselCookieProvider, detectStandardMorselProvider } from './detect';
import { MORSEL_COOKIE_WALLET_NAME, MORSEL_COOKIE_WALLET_URL, MORSEL_COOKIE_WALLET_ICON, morselBrowseLink } from './constants';
import { CookieWalletAdapter } from './CookieWalletAdapter';
import { toBase64, fromBase64, toBase64Url } from './base64';
import { bytesEqual, relayPeerFingerprint, verifyApproveProof, verifySignedMessage } from './approve-proof';

const RELAY_BASE = 'wss://api.dumpsack.xyz';

/** How often the page is checked for an injected provider, and for how long at most (it then stops). */
const PROVIDER_POLL_MS = 1000;
const PROVIDER_POLL_MAX_MS = 30_000;


const toBase64url = toBase64Url;
const fromBase64url = fromBase64;

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
  return toBase64(combined);
}

function decrypt(payload: string, theirPubKey: Uint8Array, mySecretKey: Uint8Array): any {
  const combined = fromBase64(payload);
  const nonce = combined.slice(0, 24);
  const ciphertext = combined.slice(24);
  const plaintext = nacl.box.open(ciphertext, nonce, theirPubKey, mySecretKey);
  if (!plaintext) throw new Error('Decryption failed');
  return JSON.parse(new TextDecoder().decode(plaintext));
}

// ---- binding a signing result to its request --------------------------------------------------------

/** The wire bytes of a transaction, legacy or versioned, with signatures as they stand. */
function wireBytesOf(tx: Transaction | VersionedTransaction): Uint8Array {
  return tx instanceof VersionedTransaction
    ? tx.serialize()
    : new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
}

/**
 * Check that `signedBytes` is the transaction `requestBytes` was, signed: the same message bytes (read
 * from the wire, never recompiled), and when `signer` is one of its required signers, a signature of
 * that key over them. Throws a WalletSignTransactionError otherwise.
 */
function assertSignedMatches(requestBytes: Uint8Array, signedBytes: Uint8Array, signer: PublicKey | null): void {
  let request: VersionedTransaction;
  let signed: VersionedTransaction;
  try {
    request = VersionedTransaction.deserialize(requestBytes);
    signed = VersionedTransaction.deserialize(signedBytes);
  } catch {
    throw new WalletSignTransactionError('The signed transaction could not be read');
  }
  const requestMessage = request.message.serialize();
  const signedMessage = signed.message.serialize();
  if (!bytesEqual(requestMessage, signedMessage)) {
    throw new WalletSignTransactionError('The signed transaction does not match the request');
  }
  if (!signer) return;
  const keys = signed.message.staticAccountKeys;
  const required = signed.message.header.numRequiredSignatures;
  const index = keys.findIndex((k) => k.equals(signer));
  if (index < 0 || index >= required) return; // not a signer of this transaction: nothing of ours to check
  const signature = signed.signatures[index];
  if (!signature || !nacl.sign.detached.verify(signedMessage, signature, signer.toBytes())) {
    throw new WalletSignTransactionError('The wallet returned no valid signature for this account');
  }
}

/** Read a signature (or `signedMessage`) field in any of the shapes providers use. */
function bytesField(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value) && value.every((x) => typeof x === 'number')) return new Uint8Array(value);
  if (typeof value === 'string') {
    try { return fromBase64(value); } catch { return null; }
  }
  return null;
}


type PendingRequest = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
};

/** Why a `session_approve` was refused. */
export type ApproveProofFailure = 'missing' | 'invalid';

export type SessionCallbacks = {
  onScanned: () => void;
  onWalletLeft: () => void;
  onApprove: (walletAddress: string, peerFingerprint: string) => void;
  /** The peer claimed an address without proving it holds the key: the pairing is refused. */
  onBadProof: (why: ApproveProofFailure) => void;
  onReject: () => void;
  onClose: (wasConnected: boolean) => void;
};

/**
 * One pairing with the Morsel phone app over the relay. Exported for tests; dApps use the adapter.
 */
export class MorselRelaySession {
  readonly sessionId: string;
  readonly uri: string;
  connected = false;
  closed = false;
  /** Fingerprint of the paired wallet's channel key, once approved (see relayPeerFingerprint). */
  peerFingerprint: string | null = null;

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
        else if (this.walletPubKey) cb.onWalletLeft();

      } else if (msg.type === 'peer_joined' && msg.role === 'wallet') {
        cb.onScanned();

      } else if (msg.type === 'wallet_hello') {
        // The first well-formed hello binds this session to that channel key; every later one (another
        // peer on the same session, or a replay) is ignored, so the key cannot be swapped under us.
        if (this.walletPubKey) return;
        let key: Uint8Array;
        try { key = fromBase64url(String(msg.pubkey ?? '')); } catch { return; }
        if (key.length !== nacl.box.publicKeyLength) return;
        this.walletPubKey = key;
        cb.onScanned();
        this.proposalId = generateRequestId();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const name = typeof document !== 'undefined' ? (document.title || window.location.hostname) : 'dApp';
        const icon = origin ? `${origin}/favicon.ico` : '';
        this._sendEncrypted({ type: 'session_proposal', id: this.proposalId, metadata: { name, icon, origin } });

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
      case 'session_approve': {
        if (msg.id !== this.proposalId || this.connected || !this.walletPubKey) break;
        // The address is only taken from a peer that proves it holds its key (approve-proof.ts).
        let address: PublicKey;
        try { address = new PublicKey(String(msg.walletAddress ?? '')); } catch { cb.onBadProof('invalid'); break; }
        if (msg.signature === undefined || msg.signature === null || msg.signature === '') { cb.onBadProof('missing'); break; }
        const ok = verifyApproveProof(
          {
            sessionId: this.sessionId,
            dappX25519Pub: this.keyPair.publicKey,
            walletX25519Pub: this.walletPubKey,
            walletAddress: address.toBytes(),
          },
          msg.signature,
          msg.signedMessage
        );
        if (!ok) { cb.onBadProof('invalid'); break; }
        this.connected = true;
        this.peerFingerprint = relayPeerFingerprint(this.walletPubKey);
        cb.onApprove(address.toBase58(), this.peerFingerprint);
        break;
      }

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
  relayStatusChange: (status: MorselRelayStatus) => void;
};

// On a phone browser without Morsel's provider, "Connect" opens this very page inside Morsel
// (like Phantom's browse links): Morsel's browser injects its provider and the site connects there.
// Universal / App Link first; the page it lands on falls back to morsel:// and to installing Morsel.
function openInMorselApp(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!mobile) return false;
  window.location.href = morselBrowseLink(window.location.href, window.location.origin);
  return true;
}


export class MorselCookieWalletAdapter extends EventEmitter<AdapterEvents> implements CookieWalletAdapter {
  name = MORSEL_COOKIE_WALLET_NAME;
  url = MORSEL_COOKIE_WALLET_URL;
  icon = MORSEL_COOKIE_WALLET_ICON;
  publicKey: PublicKey | null = null;
  connected = false;
  connecting = false;
  readyState: WalletReadyState = 'NotDetected';
  supportedTransactionVersions: ReadonlySet<'legacy' | 0> = new Set(['legacy', 0]);
  /**
   * The live `morsel://connect` pairing URI shown as the QR; empty until a relay session is started
   * ({@link startRelaySession}, the widget's QR view, or a `connect()` with no provider on the page).
   */
  wcUri = '';
  /** When the current {@link wcUri} was minted (ms epoch). The relay keeps it for 5 minutes. */
  wcUriCreatedAt = 0;
  /** Where the QR / relay pairing stands; see {@link MorselRelayStatus}. */
  relayStatus: MorselRelayStatus = 'idle';
  /**
   * While connected through the relay: a short fingerprint (`xxxx-xxxx`) of the phone's channel key,
   * the key the end-to-end encryption and the wallet's signed proof are bound to. Null otherwise.
   */
  relayPeerFingerprint: string | null = null;

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
    // Browser only: on the server (SSR) a timer per render would leak and keep Node alive. The relay is
    // not contacted here: a session starts when the QR is asked for (nothing leaves the page before).
    if (typeof window !== 'undefined') this._startProviderPolling();
  }


  private _setRelayStatus(status: MorselRelayStatus): void {
    if (this.relayStatus === status) return;
    this.relayStatus = status;
    this.emit('relayStatusChange', status);
  }

  /**
   * Open a relay session and mint the pairing QR, if none is live. Call it when your QR view opens;
   * the Morsel widget does. Does nothing on the server or while connected through the relay.
   */
  startRelaySession(): void {
    if (typeof window === 'undefined' || this.relayConnected) return;
    if (this.relaySession && !this.relaySession.closed) return;
    this._startRelaySession();
  }

  /**
   * Mint a fresh pairing QR (new session id and keys). Use it to refresh an expired QR. A live
   * relay connection is left alone.
   */
  restartRelaySession(): void {
    if (typeof window === 'undefined' || this.relayConnected) return;
    this._startRelaySession();
  }

  /**
   * Close an unpaired relay session and drop the QR, so nothing stays open to the relay while no QR
   * is on screen. A connection made through the relay is left alone: that is `disconnect()`.
   */
  stopRelaySession(): void {
    if (this.relayConnected) return;
    this.relaySession?.end();
    this.relaySession = null;
    if (this.wcUri) {
      this.wcUri = '';
      this.wcUriCreatedAt = 0;
      this.emit('wcUriChange', '');
    }
    this._setRelayStatus('idle');
  }

  private _startRelaySession(): void {
    this.relaySession?.end();
    const session = new MorselRelaySession();
    this.relaySession = session;
    this.wcUri = session.uri;
    this.wcUriCreatedAt = Date.now();
    this.emit('wcUriChange', session.uri);
    this._setRelayStatus('waiting');

    session.start({
      onScanned: () => {
        if (this.relaySession === session && !session.connected) this._setRelayStatus('scanned');
      },
      onWalletLeft: () => {
        // The phone backed out before approving. That session already holds the wallet's key, so
        // it cannot be paired again: mint a fresh QR.
        if (this.relaySession === session) this._startRelaySession();
      },
      onApprove: (walletAddress, peerFingerprint) => {
        try {
          const pk = new PublicKey(walletAddress);
          this.publicKey = pk;
          this.connected = true;
          this.relayConnected = true;
          this.relayPeerFingerprint = peerFingerprint;
          if (this.readyState !== 'Installed') {
            this.readyState = 'Installed';
            this.emit('readyStateChange', this.readyState);
          }
          this._setRelayStatus('connected');
          this.emit('connect', pk);
        } catch { /* ignore invalid address */ }
      },
      onBadProof: (why) => {
        // Whoever answered holds the channel key but could not prove the address: not paired. The
        // session is spent (its channel key is taken), so a fresh QR follows, and the page is told.
        if (this.relaySession !== session) return;
        this.emit('error', new WalletConnectionError(
          why === 'missing'
            ? 'Morsel on your phone needs an update before it can connect here.'
            : 'The phone could not prove it holds this wallet. Scan the code again.'
        ));
        this._startRelaySession();
      },
      onReject: () => {
        this._setRelayStatus('rejected');
        setTimeout(() => {
          if (this.relaySession === session) this._startRelaySession();
        }, 500);
      },
      onClose: (wasConnected) => {
        this.relayConnected = false;
        this.relayPeerFingerprint = null;
        if (wasConnected && !this.provider) {
          this.publicKey = null;
          this.connected = false;
          this.emit('disconnect');
        }
        // Dropped by the relay while still wanted (not ended by us): keep a QR live.
        if (!session.closed && this.relaySession === session) {
          setTimeout(() => {
            if (this.relaySession === session && !session.closed) this._startRelaySession();
          }, 500);
        }
      },
    });
  }


  private _startProviderPolling(): void {
    if (this.refreshIntervalId !== null) return;
    const startedAt = Date.now();
    this.refreshIntervalId = setInterval(() => {
      this.refreshProvider();
      // Found, or given long enough: an extension injects at load, so stop asking after a while.
      if (this.provider || Date.now() - startedAt >= PROVIDER_POLL_MAX_MS) this._stopProviderPolling();
    }, PROVIDER_POLL_MS);
  }

  private _stopProviderPolling(): void {
    if (this.refreshIntervalId === null) return;
    clearInterval(this.refreshIntervalId);
    this.refreshIntervalId = null;
  }

  refreshProvider(): void {
    // Injected provider first (window.morsel / cookie / dumpsack, any shape); if the wallet only
    // registered through the Wallet Standard, adapt that as the provider instead.
    const newProvider = detectMorselCookieProvider() ?? detectStandardMorselProvider();
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
    if (!this.provider && openInMorselApp()) {
      // Handed off: the page reopens inside Morsel's browser, which connects on its own.
      return new Promise<void>(() => { });
    }
    if (!this.provider) {
      // No Morsel on this page: the way in is the QR. Open the relay now so `wcUri` is ready to show.
      this.startRelaySession();
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
      // End the paired session; a new QR is minted when a QR view next asks for one.
      this.relaySession.end();
      this.relaySession = null;
      this.relayConnected = false;
      this.relayPeerFingerprint = null;
      this.wcUri = '';
      this.wcUriCreatedAt = 0;
      this.emit('wcUriChange', '');
      this._setRelayStatus('idle');
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
        const requestBytes = wireBytesOf(transaction);
        const signed = await this.provider.signTransaction(transaction);
        assertSignedMatches(requestBytes, wireBytesOf(signed), this.publicKey);
        return signed;
      } catch (error) {
        const walletError = error instanceof WalletAdapterError ? error : new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    if (this.relayConnected && this.relaySession) {
      try {
        const isVersioned = transaction instanceof VersionedTransaction;
        const bytes = wireBytesOf(transaction);
        const id = generateRequestId();
        const result = await this.relaySession.sendRequest(
          { type: 'sign_transaction', id, transaction: toBase64(bytes) },
          60_000
        );
        if (typeof result?.transaction !== 'string') throw new WalletSignTransactionError('The wallet returned no transaction');
        const signed = fromBase64(result.transaction);
        // Bound to the request: the same message, carrying this account's signature over it.
        assertSignedMatches(bytes, signed, this.publicKey);
        return isVersioned ? VersionedTransaction.deserialize(signed) : Transaction.from(signed as any);
      } catch (error) {
        const walletError = error instanceof WalletAdapterError ? error : new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
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
        const requestBytes = transactions.map(wireBytesOf);
        const signed = await this.provider.signAllTransactions(transactions);
        if (!Array.isArray(signed) || signed.length !== transactions.length) {
          throw new WalletSignTransactionError('The wallet returned a different number of transactions');
        }
        signed.forEach((tx, i) => assertSignedMatches(requestBytes[i], wireBytesOf(tx), this.publicKey));
        return signed;
      } catch (error) {
        const walletError = error instanceof WalletAdapterError ? error : new WalletSignTransactionError(error instanceof Error ? error.message : 'Unknown error');
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
        let signature: Uint8Array | null;
        let signedMessage: Uint8Array | null = null;
        if (result && typeof result === 'object' && !(result instanceof Uint8Array) && !Array.isArray(result) && 'signature' in result) {
          signature = bytesField((result as any).signature);
          if (!signature) throw new WalletSignMessageError('Unsupported signature format');
          signedMessage = bytesField((result as any).signedMessage);
        } else {
          signature = bytesField(result);
          if (!signature) throw new WalletSignMessageError('Invalid signature response');
        }
        return this._checkedSignedMessage(message, signature, signedMessage);
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
          { type: 'sign_message', id, message: toBase64(message) },
          60_000
        );
        if (typeof result?.signature !== 'string') throw new WalletSignMessageError('The wallet returned no signature');
        const signature = new Uint8Array(bs58.decode(result.signature));
        const signedMessage = typeof result.signedMessage === 'string' ? new Uint8Array(bs58.decode(result.signedMessage)) : null;
        return this._checkedSignedMessage(message, signature, signedMessage);
      } catch (error) {
        const walletError = error instanceof WalletAdapterError ? error : new WalletSignMessageError(error instanceof Error ? error.message : 'Unknown error');
        this.emit('error', walletError);
        throw walletError;
      }
    }

    throw new WalletNotConnectedError();
  }

  /**
   * A message signature is only handed back once it verifies for the connected account over the
   * message itself, or over the off-chain envelope a hardware wallet signed (then `signedMessage`
   * is returned too, so the dApp can verify the same bytes).
   */
  private _checkedSignedMessage(message: Uint8Array, signature: Uint8Array, signedMessage: Uint8Array | null): SignedMessageResponse {
    if (!this.publicKey) throw new WalletNotConnectedError();
    if (!verifySignedMessage(message, signature, this.publicKey.toBytes(), signedMessage)) {
      throw new WalletSignMessageError('The signature does not verify for the connected account');
    }
    const envelope = signedMessage && !bytesEqual(signedMessage, message) ? signedMessage : undefined;
    return envelope ? { signature, signedMessage: envelope } : { signature };
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
    this._stopProviderPolling();
    this.removeAllListeners();
    if (this.provider?.off) this.provider.off('accountChanged', this.accountChangedListener);
    if (typeof window !== 'undefined') window.removeEventListener('accountChanged', this.windowAccountChangedListener);
    this.relaySession?.end();
    this.relaySession = null;
    this.relayStatus = 'idle';
    this.relayPeerFingerprint = null;
    this.wcUri = '';
    this.wcUriCreatedAt = 0;
    this.provider = null;
    this.publicKey = null;
    this.connected = false;
    this.connecting = false;
    this.relayConnected = false;
  }
}
