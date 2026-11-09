/**
 * WalletProvider's network (`chain`, `chains`, `rpcUrl`), useChain, useWalletBalance's default, the
 * account chip's network mark, and which wallets the connect widget offers on a network: Morsel always,
 * another wallet only where it advertises the network, and "Morsel supports <network>" when no other
 * installed wallet does. Rendered on the server (nothing touches a network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { Keypair } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import {
  WalletProvider, WalletModalProvider, ConnectButton, useChain, useWallet, useWalletBalance,
  MorselWalletAdapter, StandardWalletAdapter, svmChain,
} from '../dist/index.js';
import { nextChain, offeredChains, rpcUrlFor } from '../dist/react/chain-state.js';
import { walletsForChain } from '../dist/ui/kit/wallets.js';
import { WidgetLayer, NetworkPicker, onlyMorselNote } from '../dist/ui/kit/ConnectWidget.js';
import { getMorselConnectCss } from '../dist/ui/kit/styles.js';

/** Render `probe` inside a WalletProvider with `props`; return what it saw. */
function within(props, probe) {
  let seen;
  const Probe = () => {
    seen = probe();
    return null;
  };
  renderToString(h(WalletProvider, { ...props, children: h(Probe) }));
  return seen;
}

test('no chain given: Solana, with its public endpoint', () => {
  const { chain, chains, connection } = within({}, () => useChain());
  assert.equal(chain.key, 'solana');
  assert.deepEqual(chains.map((c) => c.key), ['solana']);
  assert.equal(connection.rpcEndpoint, 'https://api.mainnet-beta.solana.com');
});

test('chain and chains: the app’s network, the ones it offers, and Morsel signing for it', () => {
  const seen = within({ chain: 'fogo', chains: ['fogo', 'solana'] }, () => ({ ...useChain(), wallet: useWallet().wallet }));
  assert.equal(seen.chain.key, 'fogo');
  assert.deepEqual(seen.chains.map((c) => c.key), ['fogo', 'solana']);
  assert.equal(seen.connection.rpcEndpoint, 'https://mainnet.fogo.io');
  assert.ok(seen.wallet instanceof MorselWalletAdapter);
  assert.equal(seen.wallet.chain.key, 'fogo', 'the default Morsel adapter signs for the app’s network');
  // By id too; a chain outside `chains` comes first.
  const other = within({ chain: 'solana:4SvBP3omtvcCVWdxq1zBY5cDp4wndjsT', chains: ['fogo'] }, () => useChain());
  assert.deepEqual(other.chains.map((c) => c.key), ['x1', 'fogo']);
});

test('rpcUrl: a string for the app’s network only; a record or a function for several', () => {
  assert.equal(within({ chain: 'x1', rpcUrl: 'https://my.x1' }, () => useChain().connection.rpcEndpoint), 'https://my.x1');
  assert.equal(within({ chain: 'solayer', rpcUrl: { solayer: 'https://my.solayer' } }, () => useChain().connection.rpcEndpoint), 'https://my.solayer');
  assert.equal(within({ chain: 'cookie', rpcUrl: (c) => (c.key === 'cookie' ? 'https://my.cookie' : undefined) }, () => useChain().connection.rpcEndpoint), 'https://my.cookie');
  const home = svmChain('fogo');
  assert.equal(rpcUrlFor('https://my.fogo', home, home), 'https://my.fogo');
  assert.equal(rpcUrlFor('https://my.fogo', svmChain('solana'), home), undefined, 'never a Fogo node for Solana');
  assert.equal(rpcUrlFor({ 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'https://by.id' }, svmChain('solana'), home), 'https://by.id');
  assert.equal(rpcUrlFor(undefined, home, home), undefined);
});

test('an unknown network is refused: as the chain prop, in chains, and by setChain', () => {
  assert.throws(() => within({ chain: 'solana:unknownchain00000000000000000000' }, () => useChain()), /Unknown SVM network/);
  assert.throws(() => within({ chain: 'eclipse' }, () => useChain()), /Unknown SVM network/);
  assert.throws(() => within({ chains: ['fogo', 'nope'] }, () => useChain()), /Unknown SVM network/);
  const { setChain } = within({ chain: 'fogo', chains: ['fogo', 'solana'] }, () => useChain());
  assert.throws(() => setChain('nope'), /Unknown SVM network/);
  assert.throws(() => setChain('x1'), /X1 is not one of this app's networks \(fogo, solana\)/);
  // The rules setChain applies.
  const offered = [svmChain('fogo'), svmChain('solana')];
  assert.equal(nextChain(offered, 'solana:mainnet').key, 'solana');
  assert.equal(nextChain(null, 'sonicsvm').key, 'sonicsvm', 'no chains given: any known network');
  assert.throws(() => nextChain(null, 'solana:null'), /Unknown SVM network/);
  assert.deepEqual(offeredChains(null, svmChain('x1')).map((c) => c.key), ['x1']);
  assert.deepEqual(offeredChains(offered, svmChain('fogo')).map((c) => c.key), ['fogo', 'solana']);
  const Outside = () => (useChain(), null);
  assert.throws(() => renderToString(h(Outside)), /useChain must be used within a WalletProvider/);
});

test('useWalletBalance reads the app’s network by default and says its gas token', () => {
  assert.equal(within({ chain: 'fogo' }, () => useWalletBalance().symbol), 'FOGO');
  assert.equal(within({ chain: 'x1' }, () => useWalletBalance(undefined, { autoFetch: false }).symbol), 'XNT');
  const b = within({ chain: 'cookie' }, () => useWalletBalance(null));
  assert.equal(b.balance, null);
  assert.equal(b.symbol, 'COOK');
});

/** An adapter that is already connected, so the server renders the account chip. */
class ConnectedAdapter extends EventEmitter {
  name = 'Morsel Cookie Wallet';
  url = '';
  icon = '';
  publicKey = Keypair.generate().publicKey;
  connected = true;
  connecting = false;
  readyState = 'Installed';
  supportedTransactionVersions = new Set(['legacy', 0]);
  chain = null;
  setChain(c) { this.chain = c; }
  async connect() {}
  async disconnect() {}
  async signTransaction(t) { return t; }
  async signAllTransactions(t) { return t; }
  async signMessage() { return { signature: new Uint8Array(64) }; }
  async sendTransaction() { return ''; }
}

test('the account chip shows the network’s mark and name', () => {
  const html = renderToString(
    h(WalletProvider, { chain: 'fogo', adapters: [new ConnectedAdapter()], children: h(WalletModalProvider, { children: h(ConnectButton) }) })
  );
  assert.match(html, /class="mw-scope mw-chip"/);
  assert.match(html, /aria-label="Account [^"]+ on Fogo"/);
  assert.match(html, /<img class="mw-chip-net" src="data:image\/svg\+xml,[^"]+" alt="" title="Fogo"/);
});

// ---- which wallets the widget offers --------------------------------------------------------------

function standard(name, chains) {
  return new StandardWalletAdapter({ name, icon: 'data:image/svg+xml,' + 'x'.repeat(40), chains, accounts: [], features: {} });
}
class NotInstalled extends ConnectedAdapter {
  constructor(name) { super(); this.name = name; this.connected = false; this.publicKey = null; this.readyState = 'NotDetected'; }
}
const wallets = () => {
  const morsel = new MorselWalletAdapter();
  return [
    morsel,
    standard('Phantom', ['solana:mainnet', 'solana:devnet', 'solana:testnet']),
    standard('Backpack', ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpK', 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD2519']),
    new NotInstalled('Trust'),
  ];
};
const names = (list) => list.map((x) => x.a.name);

test('walletsForChain: Morsel always, others only where they advertise the network', () => {
  const adapters = wallets();
  const fogo = walletsForChain(adapters, svmChain('fogo'));
  assert.equal(fogo.morselIndex, 0);
  assert.deepEqual(names(fogo.others), ['Backpack', 'Trust']);
  assert.deepEqual(names(fogo.detected), ['Backpack']);
  assert.deepEqual(names(fogo.unsupported), ['Phantom']);
  assert.deepEqual(fogo.others.map((x) => x.i), [2, 3], 'indexes into useWallet().adapters');

  const solana = walletsForChain(adapters, svmChain('solana'));
  assert.deepEqual(names(solana.detected), ['Phantom', 'Backpack']);
  assert.deepEqual(names(solana.unsupported), []);
  assert.deepEqual(names(walletsForChain(adapters, svmChain('solana-devnet')).detected), ['Phantom']);

  const cookie = walletsForChain(adapters, svmChain('cookie'));
  assert.deepEqual(names(cookie.detected), []);
  assert.deepEqual(names(cookie.unsupported), ['Phantom', 'Backpack']);

  assert.deepEqual(names(walletsForChain(adapters, null).others), ['Phantom', 'Backpack', 'Trust'], 'no network: everything');
  adapters[0].destroy();
});

function widget(chain, adapters, chains = [chain, 'solana']) {
  const props = { closing: false, onExited() {} };
  return renderToString(
    h(WalletProvider, {
      chain,
      chains,
      adapters,
      children: h(WalletModalProvider, { children: h(WidgetLayer, props) }),
    })
  );
}

test('the widget on Solana: Morsel first, every wallet that has Solana under it', () => {
  const adapters = wallets();
  const html = widget('solana', adapters);
  assert.match(html, /Works on Solana/);
  assert.match(html, /Phantom/);
  assert.match(html, /Backpack/);
  assert.doesNotMatch(html, /Morsel supports/);
  adapters[0].destroy();
});

test('the widget on a network only Morsel has here: "Morsel supports <network>", and no other wallet', () => {
  const adapters = wallets();
  const html = widget('cookie', adapters);
  assert.match(html, /Works on Cookie Chain/);
  assert.match(html, /<p class="mw-note[^"]*"[^>]*>Morsel supports Cookie Chain\. Phantom and Backpack do not yet\.<\/p>/);
  assert.doesNotMatch(html, /mw-row-name">(Phantom|Backpack)/, 'not offered');
  assert.match(html, /aria-label="Network: Cookie Chain\. Change network"/, 'the network picker shows where the app is');
  adapters[0].destroy();

  const fogo = wallets();
  const fhtml = widget('solayer', [fogo[0], fogo[1]]);
  assert.match(fhtml, /Works on Solayer/);
  assert.match(fhtml, />Morsel supports Solayer\. Phantom does not yet\.</);
  fogo[0].destroy();

  const none = wallets();
  assert.match(widget('x1', [none[0]]), />Morsel supports X1\.<\/p>/, 'nothing else installed: just that');
  none[0].destroy();

  assert.equal(onlyMorselNote('Fogo', ['A', 'B', 'C']), 'Morsel supports Fogo. Your other wallets do not yet.');
});

test('the widget on Fogo: Backpack, which advertises Fogo, is offered; Phantom is not', () => {
  const adapters = wallets();
  const html = widget('fogo', adapters);
  assert.match(html, /Works on Fogo/);
  assert.match(html, /Backpack/);
  assert.doesNotMatch(html, /Phantom/);
  assert.doesNotMatch(html, /Morsel supports/);
  adapters[0].destroy();
});

const MAINNETS = ['solana', 'cookie', 'fogo', 'sonicsvm', 'x1', 'solayer'];

test('the Morsel row names the app’s network on every one, never a fixed one', () => {
  for (const key of MAINNETS) {
    const adapters = wallets();
    const html = widget(key, adapters, MAINNETS);
    assert.match(html, new RegExp(`<span class="mw-hero-sub">Works on ${svmChain(key).name}</span>`), key);
    assert.doesNotMatch(html, /Built for Cookie Chain/, key);
    adapters[0].destroy();
  }
});

test('six networks fit: one compact picker naming the current network, not a row of every network', () => {
  const adapters = wallets();
  const html = widget('fogo', adapters, MAINNETS);
  const pickers = html.match(/<button type="button" class="mw-netbtn"[^>]*>/g) ?? [];
  assert.equal(pickers.length, 1);
  assert.match(pickers[0], /aria-expanded="false"/);
  assert.match(pickers[0], /aria-controls="mw-n-[a-z0-9]+"/);
  assert.match(pickers[0], /aria-label="Network: Fogo\. Change network"/);
  assert.doesNotMatch(html, /mw-netlist|mw-seg/, 'closed: no list, no row of chips');
  for (const other of ['Sonic SVM', 'Solayer', 'X1']) assert.doesNotMatch(html, new RegExp(`>${other}<`), `${other} is not laid out in the card`);
  adapters[0].destroy();
});

test('the picker opens to a list of every network: buttons, the current one marked, tied to the button', () => {
  const networks = MAINNETS.map((k) => ({ id: k, name: svmChain(k).name, icon: svmChain(k).icon }));
  const html = renderToString(h(NetworkPicker, { networks, selectedNetworkId: 'x1', defaultOpen: true }));
  const controls = html.match(/aria-controls="([^"]+)"/)[1];
  assert.match(html, new RegExp(`<ul id="${controls}" class="mw-netlist" aria-label="Networks">`));
  assert.match(html, /aria-expanded="true"/);
  const options = html.match(/<button type="button" class="mw-netopt"[^>]*>/g);
  assert.equal(options.length, 6);
  assert.deepEqual(options.map((o) => /aria-current="true"/.test(o)), [false, false, false, false, true, false]);
  for (const k of MAINNETS) assert.match(html, new RegExp(`<span class="mw-netopt-name">${svmChain(k).name}</span>`));
  // It fits the 360 px card and the phone sheet: the button never grows past it, names ellipsize,
  // and a long list scrolls inside the card.
  const css = getMorselConnectCss();
  const rule = (sel) => css.match(new RegExp(`(^|\\n)${sel}[^{\\n]*\\{([^}]*)\\}`))?.[2] ?? '';
  assert.match(rule('\\.mw-netbtn\\.mw-netbtn'), /max-width:100%/);
  assert.match(rule('\\.mw-netbtn-name\\.mw-netbtn-name,'), /white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
  assert.match(rule('\\.mw-netlist\\.mw-netlist'), /width:100%.*max-height:min\(240px,40vh\);overflow-y:auto/);
});
