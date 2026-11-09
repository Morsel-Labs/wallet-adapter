/**
 * The network table: every key, id and alias resolves to its network; an unknown id resolves to
 * nothing and is refused wherever it would be signed or read for (never Solana); the ids match the
 * Morsel wallet's own table (packages/wallet-standard/src/svm-chains.js, copied below).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Connection } from '@solana/web3.js';
import { SVM_CHAINS, svmChain, connectionFor, COOKIE_CHAIN, walletSupportsChain } from '../dist/core/index.js';
import { chainIdFor } from '../dist/core/support.js';

// The wallet's table (svm-chains.js, network id → genesis hash, or the id it is named by when it has none).
const WALLET = {
  'solana-mainnet': { key: 'solana', genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', legacy: 'solana:mainnet' },
  'solana-devnet': { key: 'solana-devnet', genesis: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', legacy: 'solana:devnet' },
  'solana-testnet': { key: 'solana-testnet', genesis: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY', legacy: 'solana:testnet' },
  'gorbagana-mainnet': { key: 'cookie', genesis: '9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2', legacy: 'gorbagana:testnet-v3' },
  'fogo-mainnet': { key: 'fogo', genesis: 'CDLtwKnaCoK157uaHQDj4fHu72AyD2519Cphmpiq6hvT' },
  'fogo-testnet': { key: 'fogo-testnet', genesis: '9GGSFo95raqzZxWqKM5tGYvJp5iv4Dm565S4r8h5PEu9' },
  'x1-mainnet': { key: 'x1', genesis: '4SvBP3omtvcCVWdxq1zBY5cDp4wndjsThb6nEMn6iMdN' },
  'x1-testnet': { key: 'x1-testnet', genesis: 'C7ucgdDEhxLTpXHhWSZxavSVmaNTUJWwT5iTdeaviDho' },
  'sonicsvm-mainnet': { key: 'sonicsvm', genesis: '9qoRTAHGWBZHYzMJGkt62wBbFRASj6H7CvoNsNyRw2h4' },
  'sonicsvm-testnet': { key: 'sonicsvm-testnet', genesis: 'BRSVhduW2sGkyhrxK6MYqyymirEggFv1hQh8jPqdYBLH' },
  'solayer-mainnet': { key: 'solayer', genesis: null, chainId: 'solayer:mainnet' },
};

test('the table: the networks of the contract, mainnets first, and the wallet’s test networks', () => {
  assert.deepEqual(SVM_CHAINS.map((c) => c.key), [
    'solana', 'cookie', 'fogo', 'sonicsvm', 'x1', 'solayer',
    'solana-devnet', 'solana-testnet', 'fogo-testnet', 'sonicsvm-testnet', 'x1-testnet',
  ]);
  assert.deepEqual(SVM_CHAINS.filter((c) => !c.testnet).map((c) => c.name), ['Solana', 'Cookie Chain', 'Fogo', 'Sonic SVM', 'X1', 'Solayer']);
  assert.ok(Object.isFrozen(SVM_CHAINS) && SVM_CHAINS.every(Object.isFrozen));
});

test('the ids are the wallet’s: CAIP-2 of the genesis hash, solayer:mainnet for Solayer', () => {
  assert.equal(SVM_CHAINS.length, Object.keys(WALLET).length);
  for (const [networkId, w] of Object.entries(WALLET)) {
    const c = svmChain(w.key);
    assert.ok(c, w.key);
    assert.equal(c.genesisHash, w.genesis, w.key);
    assert.equal(c.id, w.genesis ? `solana:${w.genesis.slice(0, 32)}` : w.chainId, w.key);
    assert.equal(svmChain(networkId)?.key, w.key, `the wallet's network id ${networkId}`);
    if (w.legacy) assert.equal(svmChain(w.legacy), c, w.legacy);
    if (w.genesis) {
      assert.equal(svmChain(`solana:${w.genesis.slice(0, 33)}`), c, 'Backpack’s 33 characters');
      assert.equal(svmChain(`solana:${w.genesis}`), c, 'the full hash');
    }
  }
  assert.equal(svmChain('solana').id, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
  assert.equal(svmChain('cookie').id, 'solana:9wDaBRDgArEUpvhHxGguNkwozsZh4UpG');
  assert.equal(svmChain('fogo').id, 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD251');
  assert.equal(svmChain('sonicsvm').id, 'solana:9qoRTAHGWBZHYzMJGkt62wBbFRASj6H7');
  assert.equal(svmChain('x1').id, 'solana:4SvBP3omtvcCVWdxq1zBY5cDp4wndjsT');
  assert.equal(svmChain('solayer').id, 'solayer:mainnet');
  assert.equal(svmChain('solayer').genesisHash, null);
});

test('every key, id and alias resolves to its own network, and no name is shared', () => {
  const seen = new Map();
  for (const c of SVM_CHAINS) {
    for (const name of [c.key, c.id, ...c.aliases]) {
      assert.equal(svmChain(name), c, `${name} → ${c.key}`);
      assert.ok(!seen.has(name) || seen.get(name) === c, `${name} names both ${seen.get(name)?.key} and ${c.key}`);
      seen.set(name, c);
    }
  }
  for (const [alias, key] of [
    ['fogo:mainnet', 'fogo'], ['x1:mainnet', 'x1'], ['sonicsvm:mainnet', 'sonicsvm'], ['solayer-mainnet', 'solayer'],
    ['cookie:mainnet', 'cookie'], ['gorbagana', 'cookie'], ['mainnet-beta', 'solana'], ['devnet', 'solana-devnet'],
    ['fogo:testnet', 'fogo-testnet'], ['FOGO', 'fogo'], ['Solayer', 'solayer'], [' fogo ', 'fogo'],
  ]) assert.equal(svmChain(alias)?.key, key, alias);
});

test('an unknown id names nothing (never Solana), and connecting to it is refused', () => {
  const unknown = [
    'solana:unknownchain00000000000000000000', 'eip155:1', '', '  ', 'solana', 'solana:null', 'solana:undefined',
    'solana:11111111111111111111111111111111', // Solayer's placeholder genesis
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdP', // Solana's id, one letter's case changed: base58 is exact
    'SOLANA:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'solayer:devnet', 'sonic:mainnet', 'eclipse:mainnet',
    'solana:EAQLJCV2mh23BsK2P9oYpV5CHVLDNHTx', 'https://api.mainnet-beta.solana.com', 'localnet',
  ];
  for (const id of unknown) {
    if (id === 'solana') continue; // 'solana' is a key
    assert.equal(svmChain(id), null, id);
    assert.throws(() => connectionFor(id), /Unknown SVM network/, id);
  }
  assert.equal(svmChain(undefined), null);
  assert.equal(svmChain(null), null);
  assert.equal(svmChain(42), null);
});

test('connectionFor: the network’s public endpoint, or yours', () => {
  const fogo = connectionFor('fogo');
  assert.ok(fogo instanceof Connection);
  assert.equal(fogo.rpcEndpoint, 'https://mainnet.fogo.io');
  assert.equal(fogo.commitment, 'confirmed');
  assert.equal(connectionFor(svmChain('x1')).rpcEndpoint, 'https://rpc.mainnet.x1.xyz');
  assert.equal(connectionFor('solana:CDLtwKnaCoK157uaHQDj4fHu72AyD251', 'https://my.fogo.rpc', 'finalized').rpcEndpoint, 'https://my.fogo.rpc');
  assert.equal(connectionFor('solana', undefined, 'processed').commitment, 'processed');
  // A network you described yourself (a local validator) is yours to name.
  const local = { ...svmChain('solana-devnet'), key: 'local', name: 'Local', id: 'solana:local', rpcUrl: 'http://127.0.0.1:8899' };
  assert.equal(connectionFor(local).rpcEndpoint, 'http://127.0.0.1:8899');
});

test('public endpoints, gas tokens and explorers per network', () => {
  const expect = {
    solana: ['SOL', 'https://api.mainnet-beta.solana.com', 'https://solscan.io/tx/sig', 'https://solscan.io/account/addr'],
    'solana-devnet': ['SOL', 'https://api.devnet.solana.com', 'https://solscan.io/tx/sig?cluster=devnet', 'https://solscan.io/account/addr?cluster=devnet'],
    cookie: ['COOK', 'https://rpc.cookiescan.io', 'https://cookiescan.io/tx/sig', 'https://cookiescan.io/address/addr'],
    fogo: ['FOGO', 'https://mainnet.fogo.io', 'https://fogoscan.com/tx/sig', 'https://fogoscan.com/account/addr'],
    sonicsvm: ['SOL', 'https://api.mainnet-alpha.sonic.game', 'https://explorer.sonicsvm.org/tx/sig', 'https://explorer.sonicsvm.org/address/addr'],
    x1: ['XNT', 'https://rpc.mainnet.x1.xyz', 'https://explorer.mainnet.x1.xyz/tx/sig', 'https://explorer.mainnet.x1.xyz/address/addr'],
    solayer: ['SOL', 'https://mainnet-rpc.solayer.org', 'https://explorer.solayer.org/tx/sig', 'https://explorer.solayer.org/address/addr'],
  };
  for (const [key, [symbol, rpc, tx, addr]] of Object.entries(expect)) {
    const c = svmChain(key);
    assert.deepEqual(c.native, { symbol, decimals: 9 }, key);
    assert.equal(c.rpcUrl, rpc, key);
    assert.equal(c.explorerTx('sig'), tx, key);
    assert.equal(c.explorerAddress('addr'), addr, key);
    assert.match(c.icon, /^data:image\/svg\+xml,/);
    assert.ok(c.icon.length < 700, `${key} mark is small`);
  }
  assert.equal(svmChain('fogo').explorerTx('a/b'), 'https://fogoscan.com/tx/a%2Fb', 'values are encoded');
  assert.equal(SVM_CHAINS.filter((c) => c.testnet).length, 5);
});

test('COOKIE_CHAIN keeps its 0.1 shape, from the table', () => {
  assert.deepEqual({ ...COOKIE_CHAIN }, {
    name: 'Cookie Chain', chainId: 'cookie-mainnet', symbol: 'COOK', rpcUrl: 'https://rpc.cookiescan.io', explorerUrl: 'https://cookiescan.io',
  });
});

test('a wallet works on a network when it advertises one of its ids; one that lists none is taken at its word', () => {
  const phantom = { chains: ['solana:mainnet', 'solana:devnet', 'solana:testnet'] };
  const backpack = { chains: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpK', 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD2519'] };
  assert.equal(walletSupportsChain(phantom, svmChain('solana')), true);
  assert.equal(walletSupportsChain(phantom, svmChain('solana-devnet')), true);
  assert.equal(walletSupportsChain(phantom, svmChain('fogo')), false);
  assert.equal(walletSupportsChain(phantom, svmChain('solayer')), false);
  assert.equal(walletSupportsChain(backpack, svmChain('fogo')), true);
  assert.equal(walletSupportsChain(backpack, svmChain('cookie')), false);
  assert.equal(walletSupportsChain({}, svmChain('fogo')), true, 'Morsel, or an adapter of your own');
  assert.equal(walletSupportsChain(null, svmChain('fogo')), false);
  // The id handed to the wallet is the one it advertises.
  assert.equal(chainIdFor(phantom.chains, svmChain('solana')), 'solana:mainnet');
  assert.equal(chainIdFor(backpack.chains, svmChain('fogo')), 'solana:CDLtwKnaCoK157uaHQDj4fHu72AyD2519');
  assert.equal(chainIdFor(['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'solana:mainnet'], svmChain('solana')), 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
  assert.equal(chainIdFor([], svmChain('x1')), svmChain('x1').id);
  assert.equal(chainIdFor(phantom.chains, svmChain('x1')), null);
});
