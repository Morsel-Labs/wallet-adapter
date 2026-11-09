# Changelog

## 0.4.0

Morsel Connect for every SVM network. The adapter stops being "Cookie Chain and Solana" and becomes the
way a dApp on any SVM network connects a wallet: Solana, Cookie Chain, Fogo, Sonic SVM, X1 and Solayer
(and the test networks the wallet knows). Where Phantom and the others do not go, Morsel is the wallet;
on Solana Morsel leads and every Wallet Standard wallet still works. The 0.3.0 relay security (the
wallet's signed approval, results bound to their requests) is unchanged.

### Added

- **`SVM_CHAINS`, `svmChain(keyOrId)`, `connectionFor(chain, rpcUrl?, commitment?)`** and the
  `SvmChain` type: every network with its chain id (CAIP-2 `solana:<first 32 of the genesis hash>`, or
  `solayer:mainnet` for Solayer, whose node has no real genesis hash), every alias that names it
  (`solana:mainnet`, `gorbagana:testnet-v3`, Backpack's 33-character form, the full hash, `fogo:mainnet`…),
  its gas token, a public RPC, explorer links and a small network mark. The ids mirror the Morsel
  wallet's own table. `svmChain` answers `null` for an id that names nothing; `connectionFor` throws.
  `COOKIE_CHAIN` stays, derived from the table.
- **`MorselWalletAdapter`** (`new MorselWalletAdapter({ chain: 'fogo' })`, `setChain()`), the new name
  of `MorselCookieWalletAdapter`, which stays as an alias of the same class.
- **The chain goes to the wallet on every request.** `signTransaction`, `signAllTransactions`,
  `sendTransaction` and the new `signAndSendTransaction` name the network: the injected provider's
  `network` argument, the Wallet Standard `chain` (for Morsel and every other wallet: the id of that
  network the wallet advertises, so Phantom gets `solana:mainnet`). The wallet signs for that network and
  refuses a transaction built for another. `options.chain` names another network for one request (Morsel
  Pay uses it to pay a Solana checkout from a page on Fogo).
- **`signAndSendTransaction(tx, options?)`** on both adapters and on `useWallet()`: the wallet signs and
  broadcasts through its own node (the injected provider, `solana:signAndSendTransaction`, or
  `sign_and_send_transaction` over the relay). A wallet that cannot send itself signs, and the
  transaction goes out through the network's connection.
- **`WalletProvider` `chain`, `chains`, `rpcUrl`, `onChainChange`** and **`useChain()`**
  (`{ chain, chains, setChain, connection }`), plus `useOptionalChain()` and `ChainContext`.
- `useWalletBalance()` reads the app's network when no connection is passed, and returns `symbol`.
- `walletSupportsChain(adapter, chain)`, `payChainOf(checkout)`, `WalletChainNotSupportedError`,
  `WalletSendTransactionError`, `ChainSendOptions`.
- The playground has a network switcher (`?chain=fogo`), and its fake wallets advertise different networks.

### Changed

- **The connect widget offers another wallet only on a network it advertises**; Morsel always. Where no
  other installed wallet has the network, it says so calmly: "Morsel supports Fogo." (and names the
  installed wallets that do not, yet). The Morsel row reads "Works on <network>". The headless modal
  filters the same way.
- **The network switch in the widget is a compact picker**: one button naming the current network, which
  opens the list of the app's networks in place (keyboard: arrows, Home/End, Esc returns to the button
  without closing the widget). It shows by itself when `WalletProvider` has more than one of `chains`, and
  for the `networks` prop as before; it fits any number of networks in the card and the phone sheet.
- The account chip shows the network's mark (and its name to screen readers and in the menu);
  `balanceSymbol` defaults to the network's gas token.
- A Wallet Standard wallet that does not advertise the app's network is refused before it is asked
  (`WalletChainNotSupportedError`: "Phantom does not support Fogo").
- Morsel Pay: a checkout's network and RPC come from `SVM_CHAINS` (`payRpcUrl`, `payChainOf`); a network
  the table does not know is refused (`MorselPayError` `network`), never paid on Solana.
- Morsel Connect (relay): with a network set, `session_proposal.metadata.chain` and every request carry
  `chain`, the chain id, as **optional metadata**. The Morsel app ignores it today (it proves which network
  a transaction belongs to by itself); the approval proof and its signed payload are unchanged.

### Compatibility

- `WalletProvider` without `chain` is on **Solana**, and the Morsel extension then signs for Solana. 0.3
  passed no network, so the extension's Cookie Chain provider signed for Cookie Chain: **Cookie Chain
  dApps add `chain="cookie"`.** A `MorselWalletAdapter` built without a chain keeps 0.3's behaviour.
- Solayer (`solayer:mainnet`) needs a Morsel wallet build that knows that id (the wallet's
  `packages/wallet-standard/src/svm-chains.js` with Solayer in it). An older build refuses it, so a
  transaction is never signed for the wrong network; it just cannot be signed there yet.
- An unknown network (in `chain`, `chains`, `setChain`, `options.chain`, a constructor) throws. It is
  never taken to mean Solana.

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
