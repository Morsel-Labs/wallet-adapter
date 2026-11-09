/**
 * Morsel Connect approve proof, v1.
 *
 * The phone authenticates the page from the QR (the dApp's X25519 key reaches it out of band). This proof
 * is the other direction: when the wallet approves a session it signs, with the ed25519 key of the address
 * it connects, a payload that binds the session id, both X25519 keys and the address together. The
 * adapter rebuilds the payload from what it observed itself (its own key, the key it decoded from the
 * first `wallet_hello`, its session id, the address it was told) and verifies the signature before it
 * reports the connection. Without a valid proof the relay peer is not the wallet of that address,
 * whatever it claims; the proof is required, never optional.
 *
 * The wallet app builds the same bytes in `src/features/relay/relay-service.js`; the two must agree byte
 * for byte. Layout — UTF-8, five lines joined with "\n", no trailing newline:
 *
 *   morsel-connect/approve/v1
 *   <sessionId>                                     the `s` of the QR, as minted
 *   <dappX25519Pub, base64url without padding>      the `k` of the QR
 *   <walletX25519Pub, base64url without padding>    the `pubkey` of wallet_hello
 *   <walletAddress, base58>                         the ed25519 public key that signs
 *
 * `session_approve` carries `walletAddress` and `signature` (base58 of the 64-byte ed25519 detached
 * signature over the payload). A hardware wallet cannot sign raw bytes: it signs the Solana off-chain
 * message envelope (0xff "solana offchain" …) that carries the payload, and `signedMessage` (base58 of
 * that envelope) is sent too. The signature is then checked over `signedMessage`, which must start with
 * that header and end with the payload.
 */
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { toBase64Url } from './base64';

export const APPROVE_PROOF_DOMAIN = 'morsel-connect/approve/v1';

/** 0xff ‖ "solana offchain": the header every Solana off-chain message envelope starts with. */
const OFFCHAIN_HEADER = new Uint8Array([0xff, ...Array.from(new TextEncoder().encode('solana offchain'))]);

export interface ApproveProofInput {
  sessionId: string;
  dappX25519Pub: Uint8Array;
  walletX25519Pub: Uint8Array;
  /** The 32 raw bytes of the wallet's ed25519 public key (what the base58 address decodes to). */
  walletAddress: Uint8Array;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The exact bytes the wallet signs (see the file comment). */
export function approveProofPayload(input: ApproveProofInput): Uint8Array {
  const lines = [
    APPROVE_PROOF_DOMAIN,
    input.sessionId,
    toBase64Url(input.dappX25519Pub),
    toBase64Url(input.walletX25519Pub),
    bs58.encode(input.walletAddress),
  ];
  return new TextEncoder().encode(lines.join('\n'));
}

/** True when `envelope` is a Solana off-chain message whose body is exactly `message` (it ends with it). */
export function envelopeCarries(envelope: Uint8Array, message: Uint8Array): boolean {
  if (envelope.length <= OFFCHAIN_HEADER.length + message.length) return false;
  if (!bytesEqual(envelope.subarray(0, OFFCHAIN_HEADER.length), OFFCHAIN_HEADER)) return false;
  return bytesEqual(envelope.subarray(envelope.length - message.length), message);
}

/**
 * Does `signature` (64 bytes) by `publicKey` cover `message`? Either directly, or over `signedMessage`
 * when that is an off-chain envelope carrying exactly `message` (a hardware wallet). Never throws.
 */
export function verifySignedMessage(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
  signedMessage?: Uint8Array | null
): boolean {
  try {
    if (signature.length !== nacl.sign.signatureLength || publicKey.length !== nacl.sign.publicKeyLength) return false;
    if (signedMessage && signedMessage.length) {
      if (bytesEqual(signedMessage, message)) return nacl.sign.detached.verify(message, signature, publicKey);
      return envelopeCarries(signedMessage, message) && nacl.sign.detached.verify(signedMessage, signature, publicKey);
    }
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

function decodeBase58(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    return new Uint8Array(bs58.decode(value));
  } catch {
    return null;
  }
}

/**
 * Verify a `session_approve` proof. `signature` and `signedMessage` are the base58 strings from the
 * message; anything missing or malformed fails closed (false).
 */
export function verifyApproveProof(input: ApproveProofInput, signature: unknown, signedMessage?: unknown): boolean {
  const sig = decodeBase58(signature);
  if (!sig) return false;
  const envelope = signedMessage === undefined || signedMessage === null ? null : decodeBase58(signedMessage);
  if (signedMessage !== undefined && signedMessage !== null && !envelope) return false;
  return verifySignedMessage(approveProofPayload(input), sig, input.walletAddress, envelope);
}

/**
 * A short fingerprint of the paired wallet's X25519 key (the key the encrypted channel is bound to):
 * the first 32 bits of its SHA-512, as `xxxx-xxxx` hex. Cheap to compute and show next to the address.
 */
export function relayPeerFingerprint(walletX25519Pub: Uint8Array): string {
  const hex = Array.from(nacl.hash(walletX25519Pub).subarray(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}
