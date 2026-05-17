# @morsel-wallet/adapter

Wallet adapter for Morsel Wallet. Connects Cookie Chain and Solana dApps with QR scanning, injected provider support, and React hooks.

## Installation

```bash
npm install @morsel-wallet/adapter
```

## Quick Start

```tsx
import {
  MorselCookieWalletAdapter,
  StandardWalletAdapter,
  WalletProvider,
  WalletModalProvider,
  ConnectButton,
} from '@morsel-wallet/adapter';
import { getWallets } from '@wallet-standard/app';

const morsel = new MorselCookieWalletAdapter();
const standard = getWallets().get().map(w => new StandardWalletAdapter(w));

export default function App() {
  return (
    <WalletProvider adapters={[morsel, ...standard]}>
      <WalletModalProvider>
        <ConnectButton />
        {/* your app */}
      </WalletModalProvider>
    </WalletProvider>
  );
}
```

## WalletModal (premium variant)

```tsx
import { WalletModal } from '@morsel-wallet/adapter';

<WalletModal variant="premium" theme="system" />
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'headless' \| 'premium'` | `'headless'` | UI style |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Color scheme |
| `logo` | `string` | Morsel logo | Custom logo URL |
| `networks` | `Network[]` | Cookie Chain + Solana | Network selector options |
| `mobileDeepLink` | `string` | `'morsel://connect'` | Fallback deep link for mobile |
| `showPoweredBy` | `boolean` | `false` | Show "Powered by Morsel" footer |

## Hooks

```tsx
import {
  useWallet,
  useWalletConnection,
  useWalletAddress,
  useSignMessage,
  useSignTransaction,
  useSendTransaction,
  useWalletBalance,
  useWalletStatus,
  useOnConnect,
  useOnDisconnect,
} from '@morsel-wallet/adapter';
```

### useWallet

Core hook — returns the full wallet context.

```tsx
const { connected, publicKey, connecting, adapters, connect, disconnect } = useWallet();
```

### useWalletAddress

```tsx
const address = useWalletAddress(); // base58 string or null
```

### useSignMessage

```tsx
const signMessage = useSignMessage();
const { signature } = await signMessage(new TextEncoder().encode('hello'));
```

### useSignTransaction

```tsx
const signTransaction = useSignTransaction();
const signed = await signTransaction(transaction);
```

### useSendTransaction

```tsx
const sendTransaction = useSendTransaction();
const signature = await sendTransaction(transaction, connection);
```

## Peer Dependencies

```json
{
  "@solana/web3.js": "^1.87.6",
  "react": "^18.0.0"
}
```

## License

MIT
