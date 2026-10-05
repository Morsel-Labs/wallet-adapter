import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '../../react/useWallet';
import { useWalletBalance } from '../../react/hooks/useWalletBalance';
import { MORSEL_LOGO_DATA_URI } from '../../core/constants';
import { useOptionalWalletModal } from '../WalletModalProvider';
import type { ConnectButtonProps } from '../types';
import { useKitStyles } from './styles';
import { animate, settled } from './motion';
import { copyText, displayWalletName, formatBalance, isMorselAdapterName, shortAddress, useIsoLayoutEffect, useResolvedTheme } from './env';
import { Avatar } from './ConnectWidget';
import { CheckIcon, ChevronDown, CopyIcon, LogoutIcon, SwitchIcon } from './icons';

/**
 * The styled connect button. Disconnected: an accent pill that opens the widget. Connected: a compact
 * account chip (avatar, short address, optional balance) with a menu to copy, switch or disconnect.
 */
export function AccountButton({
  disabled = false,
  connectingLabel = 'Connecting…',
  disconnectedLabel = 'Connect wallet',
  useModal,
  onConnectError,
  onDisconnectError,
  theme,
  accentColor,
  connection,
  balanceSymbol = 'COOK',
  showLogo = true,
  size = 'md',
  nonce,
}: ConnectButtonProps) {
  useKitStyles(nonce);
  const { connected, connecting, publicKey, activeAdapter, connect, disconnect } = useWallet();
  const modal = useOptionalWalletModal();
  const resolved = useResolvedTheme(theme);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<'closed' | 'open' | 'closing'>('closed');
  const { balance } = useWalletBalance(connection ?? null, { autoFetch: !!connection });

  const address = connected && publicKey ? publicKey.toBase58() : null;
  const scopeStyle = accentColor ? ({ ['--mw-accent' as string]: accentColor } as React.CSSProperties) : undefined;
  const sizeClass = size === 'sm' ? ' mw-sm' : '';

  // Button <-> chip: the incoming one springs in (transform / opacity only).
  const stateKey = address ? 'chip' : 'button';
  const first = useRef(true);
  useIsoLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    animate(btnRef.current, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { spring: 'bouncy', fill: 'backwards' });
  }, [stateKey]);

  useEffect(() => {
    if (!address && menu !== 'closed') setMenu('closed');
  }, [address, menu]);

  const onConnectClick = useCallback(async () => {
    if (modal && useModal !== false) {
      modal.open({ anchor: btnRef.current });
      return;
    }
    try {
      await connect();
    } catch (e) {
      onConnectError?.(e as Error);
    }
  }, [modal, useModal, connect, onConnectError]);

  if (!address) {
    const busy = connecting && !modal?.visible;
    return (
      <button
        ref={btnRef}
        type="button"
        className={`mw-scope mw-cbtn${sizeClass}`}
        data-mw-theme={resolved}
        style={scopeStyle}
        disabled={disabled || busy}
        onClick={onConnectClick}
        aria-haspopup="dialog"
      >
        {busy ? <span className="mw-spin" aria-hidden="true" /> : showLogo ? <img className="mw-logo-img" src={MORSEL_LOGO_DATA_URI} alt="" width={20} height={20} draggable={false} /> : null}
        {busy ? connectingLabel : disconnectedLabel}
      </button>
    );
  }

  const walletIconSrc = activeAdapter && isMorselAdapterName(activeAdapter.name) ? MORSEL_LOGO_DATA_URI : activeAdapter?.icon;
  const balanceText = balance !== null && balance !== undefined ? `${formatBalance(balance)} ${balanceSymbol}` : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`mw-scope mw-chip${sizeClass}`}
        data-mw-theme={resolved}
        style={scopeStyle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menu === 'open'}
        aria-label={`Account ${shortAddress(address)}`}
        onClick={() => setMenu((m) => (m === 'open' ? 'closing' : 'open'))}
      >
        <span className="mw-chip-ava">
          <Avatar address={address} size={size === 'sm' ? 24 : 28} />
          {walletIconSrc && (
            <span className="mw-chip-wallet">
              <img src={walletIconSrc} alt="" width={12} height={12} />
            </span>
          )}
        </span>
        <span>{shortAddress(address)}</span>
        {balanceText && <span className="mw-chip-bal">{balanceText}</span>}
        <ChevronDown size={15} className="mw-chev" />
      </button>
      {menu !== 'closed' && typeof document !== 'undefined' &&
        createPortal(
          <AccountMenu
            anchor={btnRef}
            theme={resolved}
            style={scopeStyle}
            closing={menu === 'closing'}
            address={address}
            walletName={activeAdapter ? displayWalletName(activeAdapter.name) : ''}
            walletIconSrc={walletIconSrc}
            balanceText={balanceText}
            onRequestClose={() => setMenu((m) => (m === 'open' ? 'closing' : m))}
            onExited={() => setMenu('closed')}
            onSwitch={() => {
              setMenu('closing');
              modal?.open({ anchor: btnRef.current });
            }}
            onDisconnect={async () => {
              setMenu('closing');
              try {
                await disconnect();
              } catch (e) {
                onDisconnectError?.(e as Error);
              }
            }}
            canSwitch={!!modal}
          />,
          document.body
        )}
    </>
  );
}

interface MenuProps {
  anchor: React.RefObject<HTMLButtonElement | null>;
  theme: 'light' | 'dark';
  style?: React.CSSProperties;
  closing: boolean;
  address: string;
  walletName: string;
  walletIconSrc?: string;
  balanceText: string | null;
  canSwitch: boolean;
  onRequestClose: () => void;
  onExited: () => void;
  onSwitch: () => void;
  onDisconnect: () => void;
}

function AccountMenu(p: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Positioned straight on the element (before paint), so it can take focus on the first frame.
  useIsoLayoutEffect(() => {
    const place = () => {
      const a = p.anchor.current?.getBoundingClientRect();
      const m = ref.current;
      if (!a || !m) return;
      const right = Math.max(12, window.innerWidth - a.right);
      const below = a.bottom + 8 + m.offsetHeight <= window.innerHeight - 8;
      m.style.right = `${right}px`;
      m.style.top = below ? `${a.bottom + 8}px` : '';
      m.style.bottom = below ? '' : `${window.innerHeight - a.top + 8}px`;
      m.style.transformOrigin = below ? '100% 0' : '100% 100%';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, []);

  useIsoLayoutEffect(() => {
    animate(ref.current, [{ opacity: 0, transform: 'translateY(-4px) scale(.96)' }, { opacity: 1, transform: 'none' }], { spring: 'snappy', fill: 'backwards' });
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true } as FocusOptions);
  }, []);

  useIsoLayoutEffect(() => {
    if (!p.closing) return;
    const a = animate(ref.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-3px) scale(.97)' }], {
      duration: 120,
      easing: 'cubic-bezier(.4,0,1,1)',
      fill: 'forwards',
    });
    settled(a).then(p.onExited);
  }, [p.closing]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || p.anchor.current?.contains(t)) return;
      p.onRequestClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [p.onRequestClose, p.anchor]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      p.onRequestClose();
      p.anchor.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[n]?.focus();
    } else if (e.key === 'Tab') {
      p.onRequestClose();
    }
  };

  const onCopy = async () => {
    if (await copyText(p.address)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <div
      ref={ref}
      className="mw-scope mw-menu"
      data-mw-theme={p.theme}
      style={p.style}
      role="menu"
      aria-label="Account"
      onKeyDown={onKeyDown}
    >
      <div className="mw-menu-head">
        <span className="mw-menu-ava">
          <Avatar address={p.address} size={56} />
          {p.walletIconSrc && (
            <span className="mw-chip-wallet">
              <img src={p.walletIconSrc} alt="" width={18} height={18} />
            </span>
          )}
        </span>
        <span className="mw-menu-addr">{shortAddress(p.address, 5, 5)}</span>
        {p.balanceText && <span className="mw-menu-bal">{p.balanceText}</span>}
        {p.walletName && <span className="mw-menu-via">Connected with {p.walletName}</span>}
      </div>
      <div className="mw-menu-sep" />
      <button type="button" role="menuitem" className="mw-item" onClick={onCopy}>
        {copied ? <CheckIcon size={18} className="mw-item-check" /> : <CopyIcon size={18} />}
        {copied ? 'Copied' : 'Copy address'}
      </button>
      {p.canSwitch && (
        <button type="button" role="menuitem" className="mw-item" onClick={p.onSwitch}>
          <SwitchIcon size={18} />
          Switch wallet
        </button>
      )}
      <button type="button" role="menuitem" className="mw-item mw-item-danger" onClick={p.onDisconnect}>
        <LogoutIcon size={18} />
        Disconnect
      </button>
      <span className="mw-sr" role="status">
        {copied ? 'Address copied' : ''}
      </span>
    </div>
  );
}
