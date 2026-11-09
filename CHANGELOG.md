# Changelog

## 0.3.0

Security hardening of the QR relay (Morsel Connect), from the November 2026 audit. The relay protocol
now **requires** a signed proof from the wallet, so this release needs a matching Morsel app.

### Requires Morsel app builds that sign `session_approve`

The wallet app signs the approval from the release that ships
`src/features/relay/relay-service.js` with `approveProofPayload` (the `sec/relay` change of
2026-11-09 and every release after it). An older app can still scan the QR, but its approval is
refused: the adapter emits a `WalletConnectionError` ("Morsel on your phone needs an update before it
can connect here."), mints a fresh QR and stays unconnected. Browser-extension and in-app-browser
connections are unaffected.

### Changed

- **The wallet proves the address it connects (CON-1).** `session_approve` carries `signature`, a
  base58 ed25519 signature over `morsel-connect/approve/v1 ‖ sessionId ‖ dappX25519Pub ‖
  walletX25519Pub ‖ walletAddress` (five `\n`-joined lines; the exact layout is documented in
  `src/core/approve-proof.ts`). The adapter rebuilds the payload from the keys it observed itself and
  verifies it before reporting the connection; a missing, forged or replayed proof is refused.
  Hardware wallets sign the Solana off-chain envelope that carries the payload and send it as
  `signedMessage`. Only the first `wallet_hello` on a session binds the channel key; later ones are
  ignored. `relayPeerFingerprint` exposes a short fingerprint of the paired channel key.
- **Signing results are bound to their request (CON-2).** `signTransaction`, `signAllTransactions`
  and therefore `sendTransaction` compare the returned transaction's message bytes with the request
  (read from the wire, never recompiled) and check the connected account's signature over them;
  `signMessage` verifies the returned signature against the connected public key and the message
  (or the off-chain envelope a hardware wallet signed, now returned as `signedMessage`). Mismatches
  throw `WalletSignTransactionError` / `WalletSignMessageError`.
- **The relay is contacted lazily (CON-3).** The constructor no longer opens a relay session. One
  starts when the widget's QR view opens, when `startRelaySession()` is called, or when `connect()`
  finds no Morsel on the page; the widget closes an unscanned session when it is dismissed
  (`stopRelaySession()`), and `disconnect()` leaves the relay idle. Polling for an injected provider
  stops once it is found, or after 30 seconds.

### Added

- `startRelaySession()`, `stopRelaySession()`, `relayPeerFingerprint` on `MorselCookieWalletAdapter`.
- `approveProofPayload`, `verifyApproveProof`, `verifySignedMessage`, `relayPeerFingerprint` and
  `APPROVE_PROOF_DOMAIN` exported from `@morsel-wallet/adapter/core`.
- `SignedMessageResponse.signedMessage` (optional): the envelope a hardware wallet signed.

### Upgrading from 0.2.x

- If you render your own QR from `wcUri`, call `startRelaySession()` when your QR view opens (and
  `stopRelaySession()` when it closes). `wcUri` is empty until then; `wcUriChange` still fires.
- Verify `signMessage` results against `signedMessage` when it is set.

## 0.2.0

The compact Morsel connect widget, React hooks and the Buffer-free core. See the README's
"Upgrading from 0.1.x".
