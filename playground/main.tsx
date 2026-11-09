import { mw, notInstalled, fakeConnection } from './stubs';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  WalletProvider,
  WalletModalProvider,
  WalletModal,
  ConnectButton,
  MorselWalletAdapter,
  SVM_CHAINS,
  svmChain,
  useChain,
  useWalletModal,
  useWallet,
  type CookieWalletAdapter,
} from '../src';

// The networks the demo offers: every mainnet, and Solana Devnet.
const CHAINS = SVM_CHAINS.filter((c) => !c.testnet || c.key === 'solana-devnet').map((c) => c.key);

const params = new URLSearchParams(location.search);
const shot = params.get('shot') === '1';
type Theme = 'light' | 'dark' | 'system';

function Bridge() {
  const modal = useWalletModal();
  const wallet = useWallet();
  const chain = useChain();
  mw.modal = modal;
  mw.wallet = wallet;
  mw.chain = chain;
  return null;
}

function Page({ theme }: { theme: 'light' | 'dark' }) {
  const modal = useWalletModal();
  const { connected } = useWallet();
  const { chain } = useChain();
  return (
    <div className={`demo demo-${theme}`}>
      <header className="demo-head">
        <div className="demo-brand">
          <span className="demo-mark" />
          Example Swap
        </div>
        <nav className="demo-nav">
          <a aria-current="page">Swap</a>
          <a>Pools</a>
          <a>Earn</a>
        </nav>
        <div className="demo-cta" id="connect-slot">
          <ConnectButton theme={theme} connection={fakeConnection} />
        </div>
      </header>
      <main className="demo-main">
        <section className="demo-card">
          <div className="demo-card-head">
            <b>Swap</b>
            <span className="demo-net">
              <img src={chain.icon} alt="" width={16} height={16} />
              {chain.name}
            </span>
          </div>
          <div className="demo-field">
            <small>You pay</small>
            <div>
              <span className="demo-amt">250</span>
              <span className="demo-token">
                <i style={{ background: 'linear-gradient(135deg,#ffd27a,#e89b2c)' }} />
                {chain.native.symbol}
              </span>
            </div>
          </div>
          <div className="demo-field">
            <small>You receive</small>
            <div>
              <span className="demo-amt muted">41.82</span>
              <span className="demo-token">
                <i style={{ background: 'linear-gradient(135deg,#2775ca,#5aa0ef)' }} />
                USDC
              </span>
            </div>
          </div>
          <button className="demo-go" onClick={() => (connected ? undefined : modal.open())}>
            {connected ? 'Swap' : 'Connect wallet to swap'}
          </button>
        </section>
      </main>
    </div>
  );
}

function Controls({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const modal = useWalletModal();
  const { chain, chains, setChain } = useChain();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (shot) return null;
  const go = (q: Record<string, string>) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(q)) p.set(k, v);
    location.search = p.toString();
  };
  return (
    <div className="ctl">
      <b>Playground</b>
      <div>
        Theme:{' '}
        {(['light', 'dark', 'system'] as Theme[]).map((t) => (
          <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>
            {t}
          </button>
        ))}
      </div>
      <div>
        Network:{' '}
        {chains.map((c) => (
          <button key={c.key} aria-pressed={chain.key === c.key} onClick={() => setChain(c.key)}>
            {c.name}
          </button>
        ))}
      </div>
      <div>
        Platform:{' '}
        {['desktop', 'ios', 'android', 'inapp'].map((p) => (
          <button key={p} aria-pressed={(params.get('platform') || 'desktop') === p} onClick={() => go({ platform: p })}>
            {p}
          </button>
        ))}
      </div>
      <div>
        Extension:{' '}
        <button aria-pressed={params.get('ext') === '1'} onClick={() => go({ ext: params.get('ext') === '1' ? '0' : '1' })}>
          Morsel extension {params.get('ext') === '1' ? 'on' : 'off'}
        </button>
      </div>
      <div>
        Wallet answers:{' '}
        {['approve', 'reject', 'error', 'hang'].map((m) => (
          <button key={m} aria-pressed={mw.walletMode.mode === m} onClick={() => (mw.walletMode.mode = m)}>
            {m}
          </button>
        ))}
      </div>
      <div>
        Phone (relay): <button onClick={() => mw.relay.scan()}>scan</button>
        <button onClick={() => mw.relay.approve()}>approve</button>
        <button onClick={() => mw.relay.reject()}>reject</button>
        <button onClick={() => mw.relay.leave()}>back out</button>
        <button onClick={() => mw.expireQr()}>expire QR</button>
      </div>
      <div>
        Widget: <button onClick={() => modal.open()}>open</button>
        <button onClick={() => modal.open({ view: 'get-morsel' })}>Get Morsel</button>
        <button onClick={() => modal.close()}>close</button>
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>((params.get('theme') as Theme) || 'light');
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)');
    const f = () => setDark(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  const resolved = theme === 'system' ? (dark ? 'dark' : 'light') : theme;
  const morsel = useMemo(() => new MorselWalletAdapter(), []);
  mw.morsel = morsel;
  const adapters = useMemo(() => [morsel as CookieWalletAdapter, ...(notInstalled as unknown as CookieWalletAdapter[])], [morsel]);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  return (
    <WalletProvider
      adapters={adapters}
      chain={svmChain(params.get('chain') || '') ? params.get('chain')! : 'solana'}
      chains={CHAINS}
      onChainChange={(c) => {
        // Keep the network in the URL, so a reload (or a screenshot run) lands on it.
        const p = new URLSearchParams(location.search);
        p.set('chain', c.key);
        history.replaceState(null, '', `?${p}`);
      }}
    >
      <WalletModalProvider>
        <Bridge />
        <Page theme={resolved} />
        <WalletModal
          theme={theme}
          placement={(params.get('place') as 'center' | 'anchor') || 'center'}
          autoClose={params.get('autoClose') !== '0'}
          accentColor={params.get('accent') || undefined}
        />
        <Controls theme={theme} setTheme={setTheme} />
      </WalletModalProvider>
    </WalletProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
