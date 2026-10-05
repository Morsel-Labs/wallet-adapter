import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { WalletProvider, WalletModalProvider, WalletModal, ConnectButton } from '../dist/index.js';

test('renders on the server without touching window', () => {
  const html = renderToString(
    h(WalletProvider, {
      children: h(WalletModalProvider, {
        children: [h(ConnectButton, { key: 'b' }), h(WalletModal, { key: 'm' }), h(WalletModal, { key: 'p', variant: 'premium', theme: 'light' })],
      }),
    })
  );
  // the styled button is server-rendered, the widget only mounts on the client (portal)
  assert.match(html, /class="mw-scope mw-cbtn"/);
  assert.match(html, /Connect wallet/);
  assert.doesNotMatch(html, /mw-root/);
});

test('unstyled button keeps its original markup when given a className', () => {
  const html = renderToString(
    h(WalletProvider, {
      children: h(WalletModalProvider, { children: h(ConnectButton, { className: 'my-btn', showAddress: true }) }),
    })
  );
  assert.match(html, /<button type="button" class="my-btn">Connect Wallet<\/button>/);
});
