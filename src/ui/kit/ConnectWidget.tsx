import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '../../react/useWallet';
import type { CookieWalletAdapter } from '../../core/CookieWalletAdapter';
import type { MorselRelayStatus } from '../../core/types';
import { MORSEL_COOKIE_WALLET_URL, MORSEL_LOGO_DATA_URI, MORSEL_RELAY_PAIRING_TTL_MS, MORSEL_WEBSITE_URL, morselBrowseLink } from '../../core/constants';
import { useWalletModal } from '../WalletModalProvider';
import type { WalletModalProps } from '../modalTypes';
import { useKitStyles } from './styles';
import { animate, cancelAnimations, prefersReducedMotion, settled } from './motion';
import {
  avatarBackground,
  displayWalletName,
  friendlyError,
  hasInjectedMorsel,
  isInMorselBrowser,
  isIOS,
  isMobileDevice,
  isMorselAdapterName,
  isUserRejection,
  shortAddress,
  useIsoLayoutEffect,
  useMedia,
  useResolvedTheme,
} from './env';
import { QrCode } from './QrCode';
import {
  AlertIcon,
  AppleGlyph,
  BackIcon,
  BoltIcon,
  CheckIcon,
  ChevronRight,
  ChromeGlyph,
  CloseIcon,
  CompassIcon,
  ExternalIcon,
  LockIcon,
  PhoneIcon,
  PlayGlyph,
  PuzzleIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  WalletIcon,
} from './icons';

type Via = 'injected' | 'relay';
type View =
  | { name: 'picker' }
  | { name: 'more' }
  | { name: 'qr' }
  | { name: 'connecting'; index: number; via: Via }
  | { name: 'connected'; index: number }
  | { name: 'error'; index: number; via: Via; reason: 'rejected' | 'failed'; message?: string }
  | { name: 'open-in-app' }
  | { name: 'get' };

type MorselLike = CookieWalletAdapter & {
  wcUri?: string;
  wcUriCreatedAt?: number;
  relayStatus?: MorselRelayStatus;
  restartRelaySession?: () => void;
};

const SHARED_MORSEL = 'morsel';
const GENERIC_WALLET_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#8a91a0" fill-opacity=".18"/><path d="M12 15.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z" fill="none" stroke="#8a91a0" stroke-width="2"/><circle cx="24" cy="20" r="1.6" fill="#8a91a0"/></svg>'
  );

function keyOf(v: View): string {
  switch (v.name) {
    case 'connecting':
      return `connecting:${v.index}:${v.via}`;
    case 'connected':
      return `connected:${v.index}`;
    case 'error':
      return `error:${v.index}:${v.reason}`;
    default:
      return v.name;
  }
}

function walletIcon(a: CookieWalletAdapter | undefined): string {
  if (!a) return GENERIC_WALLET_ICON;
  if (isMorselAdapterName(a.name)) return MORSEL_LOGO_DATA_URI;
  return a.icon && a.icon.length > 30 ? a.icon : GENERIC_WALLET_ICON;
}

export function Avatar({ address, size }: { address: string; size: number }) {
  return <span className="mw-ava" style={{ width: size, height: size, background: avatarBackground(address), display: 'block' }} />;
}

/* ------------------------------------------------------------------------------------------------ */

/** The compact Morsel connect widget (the default `WalletModal`). */
export function ConnectWidget(props: WalletModalProps) {
  useKitStyles(props.nonce);
  const modal = useWalletModal();
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (modal.visible) setPresent(true);
  }, [modal.visible]);

  if (!mounted || !(present || modal.visible) || typeof document === 'undefined') return null;
  return createPortal(
    <WidgetLayer {...props} closing={!modal.visible} onExited={() => setPresent(false)} />,
    document.body
  );
}

interface Snapshot {
  top: number;
  bottom: number;
  left: number;
  width: number;
  viewLeft: number;
  viewTop: number;
  viewWidth: number;
  ghost: HTMLElement;
  shared: Map<string, DOMRect>;
  dir: number;
}

function WidgetLayer(props: WalletModalProps & { closing: boolean; onExited: () => void }) {
  const { closing, onExited } = props;
  const wallet = useWallet();
  const { adapters, selectAdapter, activeAdapterIndex, connected, publicKey } = wallet;
  const modal = useWalletModal();
  const theme = useResolvedTheme(props.theme, true);
  const sheet = useMedia('(max-width: 639px)', false, true);
  const mobile = useMemo(isMobileDevice, []);
  const ios = useMemo(isIOS, []);
  const inMorsel = useMemo(isInMorselBrowser, []);
  const anchorEl = modal.options.anchor ?? null;
  const placement: 'center' | 'anchor' = props.placement === 'anchor' && !sheet && anchorEl ? 'anchor' : 'center';

  const morselIndex = adapters.findIndex((a) => isMorselAdapterName(a.name));
  const morsel = (morselIndex >= 0 ? adapters[morselIndex] : null) as MorselLike | null;

  const links = {
    install: props.links?.install ?? MORSEL_COOKIE_WALLET_URL,
    ios: props.links?.ios ?? props.links?.install ?? MORSEL_COOKIE_WALLET_URL,
    android: props.links?.android ?? props.links?.install ?? MORSEL_COOKIE_WALLET_URL,
    extension: props.links?.extension ?? props.links?.install ?? MORSEL_COOKIE_WALLET_URL,
    website: props.links?.website ?? MORSEL_WEBSITE_URL,
  };

  // ---- view stack -------------------------------------------------------------------------------
  const initial: View = modal.options.view === 'get-morsel' ? { name: 'get' } : { name: 'picker' };
  const [stack, setStack] = useState<View[]>([initial]);
  const view = stack[stack.length - 1];
  const viewKey = keyOf(view);
  const latest = useRef({ view, viewKey });
  latest.current = { view, viewKey };

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const slT = useRef<HTMLDivElement>(null);
  const slM = useRef<HTMLDivElement>(null);
  const slB = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const pending = useRef<Snapshot | null>(null);
  const attempt = useRef(0);
  const titleId = useRef(`mw-t-${Math.random().toString(36).slice(2, 8)}`).current;

  const snapshot = useCallback((dir: number) => {
    const card = cardRef.current;
    const v = viewRef.current;
    if (!card || !v || !slT.current || !slB.current) return;
    const t = slT.current.getBoundingClientRect();
    const b = slB.current.getBoundingClientRect();
    const vr = v.getBoundingClientRect();
    const shared = new Map<string, DOMRect>();
    v.querySelectorAll<HTMLElement>('[data-mw-shared]').forEach((el) => {
      const k = el.getAttribute('data-mw-shared');
      if (k && !shared.has(k)) shared.set(k, el.getBoundingClientRect());
    });
    pending.current = {
      top: t.top,
      bottom: b.bottom,
      left: t.left,
      width: t.width,
      viewLeft: vr.left,
      viewTop: vr.top,
      viewWidth: vr.width,
      ghost: v.cloneNode(true) as HTMLElement,
      shared,
      dir,
    };
  }, []);

  const go = useCallback(
    (next: View, mode: 'push' | 'replace' | 'reset' = 'push') => {
      if (keyOf(next) === latest.current.viewKey && mode !== 'reset') {
        setStack((s) => [...s.slice(0, -1), next]);
        return;
      }
      snapshot(mode === 'reset' ? 0 : 1);
      setStack((s) => (mode === 'push' ? [...s, next] : mode === 'replace' ? [...s.slice(0, -1), next] : [next]));
    },
    [snapshot]
  );
  const depth = useRef(stack.length);
  depth.current = stack.length;
  const back = useCallback(() => {
    if (depth.current < 2) return;
    attempt.current++;
    snapshot(-1);
    setStack((s) => (s.length < 2 ? s : s.slice(0, -1)));
  }, [snapshot]);
  const close = modal.close;

  // ---- morph between views ----------------------------------------------------------------------
  useIsoLayoutEffect(() => {
    const snap = pending.current;
    pending.current = null;
    const card = cardRef.current;
    const v = viewRef.current;
    if (!snap || !card || !v || !contentRef.current) return;
    focusView(v);
    if (prefersReducedMotion()) {
      animate(v, [{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: 'backwards' });
      return;
    }
    const next = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const R = parseFloat(cs.getPropertyValue('--mw-radius')) || 24;
    const Rb = parseFloat(cs.getPropertyValue('--mw-radius-b'));
    const rb = isNaN(Rb) ? R : Rb;
    const height = snap.bottom - snap.top;
    const dTop = snap.top - next.top;
    const dBot = snap.bottom - next.bottom;
    const dLeft = snap.left - next.left;
    const sx = next.width > 0 ? snap.width / next.width : 1;
    const midOld = height - R - rb + 2;
    const midNew = next.height - R - rb + 2;
    const sy = midNew > 0 ? Math.max(0.01, midOld / midNew) : 1;
    const opts = { spring: 'snappy' as const, fill: 'backwards' as FillMode };
    cancelAnimations(slT.current, slM.current, slB.current, shadeRef.current, headRef.current);
    animate(slT.current, [{ transform: `translate(${dLeft}px,${dTop}px) scaleX(${sx})` }, { transform: 'none' }], opts);
    animate(slB.current, [{ transform: `translate(${dLeft}px,${dBot}px) scaleX(${sx})` }, { transform: 'none' }], opts);
    animate(slM.current, [{ transform: `translate(${dLeft}px,${dTop}px) scale(${sx},${sy})` }, { transform: 'none' }], opts);
    animate(shadeRef.current, [{ transform: `translate(${dLeft}px,${dTop}px) scale(${sx},${next.height > 0 ? height / next.height : 1})` }, { transform: 'none' }], opts);
    if (dTop || dLeft) animate(headRef.current, [{ transform: `translate(${dLeft}px,${dTop}px)` }, { transform: 'none' }], opts);

    // Outgoing view: a frozen clone fades out where it was.
    const ghost = snap.ghost;
    ghost.classList.add('mw-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    ghost.style.left = `${snap.viewLeft - next.left}px`;
    ghost.style.top = `${snap.viewTop - next.top}px`;
    ghost.style.width = `${snap.viewWidth}px`;
    const incomingShared = new Map<string, HTMLElement>();
    v.querySelectorAll<HTMLElement>('[data-mw-shared]').forEach((el) => {
      const k = el.getAttribute('data-mw-shared');
      if (k && !incomingShared.has(k)) incomingShared.set(k, el);
    });
    // Measure the shared targets now, before the incoming view gets its entrance transform.
    const targetRects = new Map<string, DOMRect>();
    incomingShared.forEach((el, k) => targetRects.set(k, el.getBoundingClientRect()));
    ghost.querySelectorAll<HTMLElement>('[data-mw-shared]').forEach((el) => {
      if (incomingShared.has(el.getAttribute('data-mw-shared') || '')) el.style.opacity = '0';
    });
    contentRef.current.appendChild(ghost);
    const ga = animate(
      ghost,
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `translateX(${-snap.dir * 12}px) scale(.97)` },
      ],
      { duration: 120, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }
    );
    settled(ga).then(() => ghost.remove());

    // Incoming view rides in with the card's top edge.
    animate(
      v,
      [
        { opacity: 0, transform: `translate(${snap.dir * 16}px,${dTop}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { spring: 'snappy', delay: 70, fill: 'backwards' }
    );

    // Shared elements (the Morsel mark) fly from their old spot to the new one.
    const root = rootRef.current;
    if (root) {
      const rr = root.getBoundingClientRect();
      incomingShared.forEach((target, k) => {
        const from = snap.shared.get(k);
        if (!from) return;
        const to = targetRects.get(k)!;
        if (!to.width || !from.width) return;
        const flyer = target.cloneNode(true) as HTMLElement;
        flyer.removeAttribute('data-mw-shared');
        flyer.className = 'mw-flyer';
        flyer.style.left = `${to.left - rr.left}px`;
        flyer.style.top = `${to.top - rr.top}px`;
        flyer.style.width = `${to.width}px`;
        flyer.style.height = `${to.height}px`;
        flyer.style.borderRadius = getComputedStyle(target).borderRadius;
        root.appendChild(flyer);
        target.style.visibility = 'hidden';
        const a = animate(
          flyer,
          [
            { transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})` },
            { transform: 'none' },
          ],
          { spring: 'gentle', fill: 'both' }
        );
        settled(a).then(() => {
          flyer.remove();
          target.style.visibility = '';
        });
      });
    }
  }, [viewKey]);

  // ---- enter / exit -----------------------------------------------------------------------------
  const restoreFocus = useRef<Element | null>(null);
  useIsoLayoutEffect(() => {
    restoreFocus.current = document.activeElement;
    animate(overlayRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'backwards' });
    const card = cardRef.current;
    if (sheet) animate(card, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { spring: 'gentle', fill: 'backwards' });
    else if (placement === 'anchor')
      animate(card, [{ opacity: 0, transform: 'translateY(-6px) scale(.96)' }, { opacity: 1, transform: 'none' }], { spring: 'snappy', fill: 'backwards' });
    else animate(card, [{ opacity: 0, transform: 'translateY(12px) scale(.965)' }, { opacity: 1, transform: 'none' }], { spring: 'snappy', fill: 'backwards' });
    if (viewRef.current) focusView(viewRef.current, true);
    return () => {
      const el = restoreFocus.current as HTMLElement | null;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true } as FocusOptions);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wasClosing = useRef(false);
  useIsoLayoutEffect(() => {
    const card = cardRef.current;
    const ov = overlayRef.current;
    if (!closing) {
      if (!wasClosing.current) return;
      // Reopened while the exit animation was running: start over on the first view.
      wasClosing.current = false;
      attempt.current++;
      setStack([modal.options.view === 'get-morsel' ? { name: 'get' } : { name: 'picker' }]);
      cancelAnimations(ov);
      if (card && card.dataset.exiting) {
        cancelAnimations(card);
        delete card.dataset.exiting;
        card.style.transform = '';
      }
      return;
    }
    if (!card) {
      onExited();
      return;
    }
    wasClosing.current = true;
    card.dataset.exiting = '1';
    const current = card.style.transform || 'none';
    card.style.transform = '';
    const a1 = animate(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    const a2 = sheet
      ? animate(card, [{ transform: current }, { transform: 'translateY(105%)' }], { duration: 230, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
      : animate(card, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: placement === 'anchor' ? 'translateY(-4px) scale(.97)' : 'translateY(6px) scale(.97)' }], {
          duration: 150,
          easing: 'cubic-bezier(.4,0,1,1)',
          fill: 'forwards',
        });
    let done = false;
    Promise.all([settled(a1), settled(a2)]).then(() => {
      if (!done && card.dataset.exiting) onExited();
    });
    return () => {
      done = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  // ---- scroll lock ------------------------------------------------------------------------------
  useEffect(() => {
    if (placement === 'anchor') return;
    const html = document.documentElement;
    const body = document.body;
    const prev = { o: html.style.overflow, p: body.style.paddingRight };
    const gap = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      html.style.overflow = prev.o;
      body.style.paddingRight = prev.p;
    };
  }, [placement]);

  // ---- anchor position --------------------------------------------------------------------------
  const [anchorPos, setAnchorPos] = useState<{ top: number; right: number } | null>(null);
  useIsoLayoutEffect(() => {
    if (placement !== 'anchor' || !anchorEl) return;
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      setAnchorPos({ top: Math.round(r.bottom + 10), right: Math.max(12, Math.round(window.innerWidth - r.right)) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [placement, anchorEl]);

  // ---- relay (QR) state -------------------------------------------------------------------------
  const [qr, setQr] = useState(() => ({ uri: morsel?.wcUri || '', createdAt: morsel?.wcUriCreatedAt || Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!morsel) return;
    setQr({ uri: morsel.wcUri || '', createdAt: morsel.wcUriCreatedAt || Date.now() });
    const onUri = (uri: string) => setQr({ uri, createdAt: morsel.wcUriCreatedAt || Date.now() });
    const onStatus = (st: MorselRelayStatus) => {
      const v = latest.current.view;
      if (st === 'scanned' && v.name === 'qr') go({ name: 'connecting', index: morselIndex, via: 'relay' });
      else if (st === 'rejected' && (v.name === 'qr' || (v.name === 'connecting' && v.via === 'relay')))
        go({ name: 'error', index: morselIndex, via: 'relay', reason: 'rejected' }, 'replace');
      else if (st === 'waiting' && v.name === 'connecting' && v.via === 'relay') go({ name: 'qr' }, 'replace');
    };
    morsel.on('wcUriChange', onUri);
    morsel.on('relayStatusChange', onStatus);
    return () => {
      morsel.off('wcUriChange', onUri);
      morsel.off('relayStatusChange', onStatus);
    };
  }, [morsel, morselIndex, go]);

  const onQrView = view.name === 'qr';
  useEffect(() => {
    if (!onQrView) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [onQrView]);
  const remaining = Math.max(0, qr.createdAt + MORSEL_RELAY_PAIRING_TTL_MS - now);
  const expired = !!qr.uri && remaining <= 0;

  const refreshQr = useCallback(() => {
    if (morsel?.restartRelaySession) morsel.restartRelaySession();
    else setQr((q) => ({ ...q, createdAt: Date.now() }));
    setNow(Date.now());
  }, [morsel]);

  // ---- connection -------------------------------------------------------------------------------
  const connectAdapter = useCallback(
    async (index: number, via: Via, mode: 'push' | 'replace' = 'push') => {
      const my = ++attempt.current;
      go({ name: 'connecting', index, via }, mode);
      try {
        await selectAdapter(index);
        await adapters[index].connect();
      } catch (e) {
        if (my !== attempt.current) return;
        props.onConnectError?.(e as Error);
        go({ name: 'error', index, via, reason: isUserRejection(e) ? 'rejected' : 'failed', message: friendlyError(e) }, 'replace');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapters, selectAdapter, go, props.onConnectError]
  );

  const openQr = useCallback(
    (mode: 'push' | 'replace' = 'push') => {
      if (morselIndex >= 0) selectAdapter(morselIndex).catch(() => undefined);
      if (morsel && (!morsel.wcUri || (morsel.wcUriCreatedAt || 0) + MORSEL_RELAY_PAIRING_TTL_MS - Date.now() < 45_000)) refreshQr();
      go({ name: 'qr' }, mode);
    },
    [morsel, morselIndex, selectAdapter, refreshQr, go]
  );

  const onMorsel = useCallback(() => {
    if (!morsel) return go({ name: 'get' });
    if (hasInjectedMorsel()) return void connectAdapter(morselIndex, 'injected');
    if (mobile) return go({ name: 'open-in-app' });
    openQr();
  }, [morsel, morselIndex, mobile, connectAdapter, openQr, go]);

  const onWallet = useCallback(
    (index: number) => {
      const a = adapters[index];
      if (!a) return;
      if (a.readyState !== 'Installed' && a.url && !isMorselAdapterName(a.name)) {
        window.open(a.url, '_blank', 'noopener,noreferrer');
        return;
      }
      void connectAdapter(index, 'injected');
    },
    [adapters, connectAdapter]
  );

  const retry = useCallback(() => {
    if (view.name !== 'error') return;
    if (view.via === 'relay') openQr('replace');
    else void connectAdapter(view.index, view.via, 'replace');
  }, [view, openQr, connectAdapter]);

  // Inside Morsel's own browser there is nothing to choose: connect right away.
  useEffect(() => {
    if (props.autoConnectInMorsel === false || !inMorsel || connected || !morsel) return;
    if (initial.name !== 'picker' || !hasInjectedMorsel()) return;
    void connectAdapter(morselIndex, 'injected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Success: any new connection while open.
  const baseline = useRef(connected && publicKey ? `${activeAdapterIndex}:${publicKey.toBase58()}` : null);
  useEffect(() => {
    if (!connected || !publicKey) return;
    const k = `${activeAdapterIndex}:${publicKey.toBase58()}`;
    if (k === baseline.current) return;
    baseline.current = k;
    attempt.current++;
    go({ name: 'connected', index: activeAdapterIndex }, 'reset');
    if (props.autoClose === false) return;
    const t = setTimeout(() => close(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, activeAdapterIndex]);

  // ---- keyboard: focus trap, Esc, arrow keys ----------------------------------------------------
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    if (e.key === 'Tab') {
      const items = focusables(card);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !card.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !card.contains(active))) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const nav = Array.from(viewRef.current?.querySelectorAll<HTMLElement>('[data-mw-nav]') ?? []);
      const i = nav.indexOf(document.activeElement as HTMLElement);
      if (nav.length === 0) return;
      e.preventDefault();
      const n = e.key === 'ArrowDown' ? (i + 1) % nav.length : (i - 1 + nav.length) % nav.length;
      nav[i < 0 ? 0 : n]?.focus();
    }
  };

  // ---- sheet drag to dismiss --------------------------------------------------------------------
  const drag = useRef<{ y: number; t: number; lastY: number; lastT: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheet || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button,a,input')) return;
    drag.current = { y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    cancelAnimations(cardRef.current);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const card = cardRef.current;
    if (!d || !card || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y;
    const y = dy > 0 ? dy : -Math.sqrt(-dy) * 2.2; // rubber band upwards
    card.style.transform = `translateY(${y}px)`;
    if (overlayRef.current) overlayRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / (card.offsetHeight * 1.2)));
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    const card = cardRef.current;
    drag.current = null;
    if (!d || !card) return;
    const dy = e.clientY - d.y;
    const v = (e.clientY - d.lastY) / Math.max(1, e.timeStamp - d.lastT);
    if (dy > Math.min(140, card.offsetHeight * 0.3) || (dy > 24 && v > 0.55)) {
      close();
      return;
    }
    const from = card.style.transform || 'none';
    card.style.transform = '';
    if (overlayRef.current) overlayRef.current.style.opacity = '';
    animate(card, [{ transform: from }, { transform: 'none' }], { spring: 'snappy', fill: 'backwards' });
  };
  const dragHandlers = sheet
    ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
    : {};

  // ---- render -----------------------------------------------------------------------------------
  const rowProps: RowShared = {
    activeIndex: connected ? activeAdapterIndex : -1,
    onWallet,
    installLabel: props.installLabel ?? 'Get',
  };
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const morselName = 'Morsel';
  const viewWallet = 'index' in view ? adapters[view.index] : undefined;
  const viewWalletName = viewWallet ? displayWalletName(viewWallet.name) : morselName;
  const viewWalletIsMorsel = !viewWallet || isMorselAdapterName(viewWallet.name);

  let title: string;
  switch (view.name) {
    case 'picker':
      title = props.title ?? 'Connect a wallet';
      break;
    case 'more':
      title = 'More wallets';
      break;
    case 'qr':
      title = 'Connect Morsel';
      break;
    case 'connected':
      title = 'Connected';
      break;
    case 'get':
      title = 'Get Morsel';
      break;
    case 'open-in-app':
      title = morselName;
      break;
    default:
      title = viewWalletName;
  }
  const canBack = stack.length > 1 && view.name !== 'connected';
  const dappLogo =
    typeof props.logo === 'string' ? <img src={props.logo} alt="" width={20} height={20} style={{ borderRadius: 6 }} /> : props.logo ?? null;

  const accentStyle = props.accentColor ? ({ ['--mw-accent' as string]: props.accentColor } as React.CSSProperties) : undefined;
  const zStyle = props.zIndex !== undefined ? ({ ['--mw-z' as string]: String(props.zIndex) } as React.CSSProperties) : undefined;

  return (
    <div
      ref={rootRef}
      className="mw-scope mw-root"
      data-mw-theme={theme}
      data-mw-layout={sheet ? 'sheet' : 'card'}
      data-mw-place={placement}
      style={{ ...accentStyle, ...zStyle }}
      onKeyDown={onKeyDown}
    >
      <div ref={overlayRef} className={`mw-overlay${props.overlayClassName ? ` ${props.overlayClassName}` : ''}`} onClick={close} aria-hidden="true" />
      <div className="mw-wrap">
        <div
          ref={cardRef}
          className={`mw-card${props.className ? ` ${props.className}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={placement === 'anchor' && anchorPos ? { top: anchorPos.top, right: anchorPos.right } : undefined}
        >
          <div className="mw-surface" aria-hidden="true">
            <div ref={shadeRef} className="mw-shade" />
            <div ref={slM} className="mw-sl mw-sl-m" />
            <div ref={slT} className="mw-sl mw-sl-t" />
            <div ref={slB} className="mw-sl mw-sl-b" />
          </div>
          <div ref={contentRef} className="mw-content">
            <div className="mw-grab" aria-hidden="true" {...dragHandlers} />
            <div ref={headRef} className="mw-head" {...dragHandlers}>
              <div className="mw-head-l">
                {canBack ? (
                  <button type="button" className="mw-iconbtn" onClick={back} aria-label="Back" key="back" style={{ animation: 'mw-fade .2s both' }}>
                    <BackIcon />
                  </button>
                ) : view.name === 'picker' && dappLogo ? (
                  <span style={{ display: 'flex', padding: 7 }}>{dappLogo}</span>
                ) : null}
              </div>
              <h2 className="mw-title" id={titleId}>
                <span key={title} style={{ animation: 'mw-fade .22s both' }}>
                  {title}
                </span>
              </h2>
              <div className="mw-head-r">
                <button type="button" className="mw-iconbtn" onClick={close} aria-label={props.closeLabel ?? 'Close'}>
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div ref={viewRef} key={viewKey} className="mw-view" tabIndex={-1} data-view={view.name}>
              {view.name === 'picker' && renderPicker()}
              {view.name === 'more' && <MoreView adapters={adapters} morselIndex={morselIndex} rowProps={rowProps} />}
              {view.name === 'qr' && renderQr()}
              {view.name === 'connecting' && renderConnecting(view)}
              {view.name === 'connected' && renderConnected()}
              {view.name === 'error' && renderError(view)}
              {view.name === 'open-in-app' && renderOpenInApp()}
              {view.name === 'get' && renderGet()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ---- views ------------------------------------------------------------------------------------
  function renderPicker() {
    const others = adapters.map((a, i) => ({ a, i })).filter((x) => x.i !== morselIndex);
    const detected = others.filter((x) => x.a.readyState === 'Installed');
    const shown = detected.slice(0, 3);
    const hidden = [...detected.slice(3), ...others.filter((x) => x.a.readyState !== 'Installed')];
    const morselConnected = connected && activeAdapterIndex === morselIndex && morselIndex >= 0;
    let i = 0;
    return (
      <>
        {props.subtitle && <p className="mw-sub">{props.subtitle}</p>}
        {props.networks && props.networks.length > 1 && (
          <NetworkSwitch networks={props.networks} selectedNetworkId={props.selectedNetworkId} onNetworkChange={props.onNetworkChange} />
        )}
        <div className="mw-scroll">
          <button type="button" className="mw-hero mw-stagger" style={{ ['--i' as string]: i++ }} onClick={onMorsel} data-mw-nav="">
            <span className="mw-hero-logo">
              <img className="mw-logo-img" data-mw-shared={SHARED_MORSEL} src={MORSEL_LOGO_DATA_URI} alt="" width={44} height={44} draggable={false} />
            </span>
            <span className="mw-hero-text">
              <span className="mw-hero-name">
                Morsel <span className="mw-tag">Recommended</span>
              </span>
              <span className="mw-hero-sub">Built for Cookie Chain</span>
            </span>
            {morselConnected ? (
              <span className="mw-row-meta">
                <span className="mw-dot" />
                Connected
              </span>
            ) : (
              <span className="mw-pill">{props.connectLabel ?? 'Connect'}</span>
            )}
          </button>
          {shown.length > 0 && (
            <div className="mw-label mw-stagger" style={{ ['--i' as string]: i++ }}>
              Detected
            </div>
          )}
          <div className="mw-list">
            {shown.map(({ a, i: idx }) => (
              <WalletRow key={idx} adapter={a} index={idx} order={i++} {...rowProps} />
            ))}
            {hidden.length > 0 && (
              <button type="button" className="mw-row mw-row-more mw-stagger" style={{ ['--i' as string]: i++ }} onClick={() => go({ name: 'more' })} data-mw-nav="" aria-label={`More wallets (${hidden.length})`}>
                <span className="mw-more-ico">
                  <WalletIcon size={18} />
                </span>
                <span className="mw-row-name">More wallets</span>
                <span className="mw-stack" aria-hidden="true">
                  {hidden.slice(0, 3).map(({ a, i: idx }) => (
                    <img key={idx} src={walletIcon(a)} alt="" width={20} height={20} />
                  ))}
                </span>
                <ChevronRight size={16} className="mw-chev" />
              </button>
            )}
          </div>
        </div>
        <div className="mw-foot mw-stagger" style={{ ['--i' as string]: i++ }}>
          New to Morsel?
          <button type="button" className="mw-link" onClick={() => go({ name: 'get' })}>
            Get the app
          </button>
        </div>
        {props.showPoweredBy && <div className="mw-powered">Powered by Morsel</div>}
      </>
    );
  }

  function renderQr() {
    const mins = Math.floor(remaining / 60000);
    const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
    return (
      <div className="mw-qr-wrap">
        <div className="mw-qr-frame" data-live={!!qr.uri && !expired} data-expired={expired}>
          {qr.uri ? (
            <QrCode value={qr.uri} size={sheet ? 220 : 236} logo={MORSEL_LOGO_DATA_URI} logoShared={SHARED_MORSEL} label="Morsel connection QR code" />
          ) : (
            <div className="mw-qr-skel" style={{ width: sheet ? 220 : 236, height: sheet ? 220 : 236 }} />
          )}
          {expired && (
            <div className="mw-qr-over">
              <strong>QR code expired</strong>
              <button type="button" className="mw-btn mw-btn-primary" onClick={refreshQr} data-mw-autofocus="">
                <RefreshIcon size={16} /> Refresh
              </button>
            </div>
          )}
        </div>
        <p className="mw-qr-title">Scan with the Morsel app</p>
        <p className="mw-qr-text">Open Morsel on your phone and scan this code to connect.</p>
        <div className="mw-status" role="status" aria-live="polite" data-tone={!expired && remaining < 30000 ? 'warn' : undefined}>
          {expired ? (
            <>
              <span className="mw-dot mw-dot-warn" aria-hidden="true" /> QR code expired
            </>
          ) : (
            <>
              <span className="mw-pulse" aria-hidden="true" />
              Waiting for approval
              <span className="mw-sep" aria-hidden="true" />
              <span className="mw-timer" aria-label={`Expires in ${mins} minutes ${secs} seconds`}>
                {mins}:{secs}
              </span>
            </>
          )}
          <button type="button" className="mw-iconbtn mw-sm" onClick={refreshQr} aria-label="New QR code" title="New QR code">
            <RefreshIcon size={14} />
          </button>
        </div>
        <div className="mw-qr-actions mw-row2">
          <a className="mw-btn mw-btn-ghost" href={links.extension} target="_blank" rel="noopener noreferrer">
            <PuzzleIcon size={16} /> Get the extension
          </a>
          <button type="button" className="mw-btn mw-btn-ghost" onClick={() => go({ name: 'get' })}>
            <PhoneIcon size={16} /> Get the app
          </button>
        </div>
      </div>
    );
  }

  function walletVisual(index: number, badge?: React.ReactNode, ring = false) {
    const a = adapters[index];
    const isM = !a || isMorselAdapterName(a.name);
    return (
      <div className="mw-orbit">
        {ring ? (
          <>
            <span className="mw-orbit-track" />
            <span className="mw-orbit-ring" />
          </>
        ) : null}
        {isM ? (
          <img className="mw-logo-img" data-mw-shared={SHARED_MORSEL} src={MORSEL_LOGO_DATA_URI} alt="" width={64} height={64} draggable={false} />
        ) : (
          <img className="mw-orbit-icon" src={walletIcon(a)} alt="" width={64} height={64} />
        )}
        {badge}
      </div>
    );
  }

  function renderConnecting(v: Extract<View, { name: 'connecting' }>) {
    const name = viewWalletName;
    const relay = v.via === 'relay';
    return (
      <div className="mw-center">
        {walletVisual(v.index, relay ? <span className="mw-badge mw-badge-info"><PhoneIcon size={15} /></span> : undefined, true)}
        <h3 className="mw-h">{relay ? 'Approve on your phone' : `Approve in ${name}`}</h3>
        <p className="mw-p">
          {relay
            ? 'Morsel is asking you to approve this connection. Confirm it in the app to continue.'
            : `Confirm the connection in ${name} to continue.`}
        </p>
        {host && (
          <span className="mw-origin">
            <LockIcon size={13} />
            <span>{host}</span>
          </span>
        )}
        <div className="mw-actions">
          {viewWalletIsMorsel && !relay && !mobile ? (
            <button type="button" className="mw-btn mw-btn-ghost" onClick={() => openQr('replace')}>
              <PhoneIcon size={16} /> Use the Morsel app instead
            </button>
          ) : null}
        </div>
        <span className="mw-sr" role="status">
          {relay ? 'Waiting for approval on your phone' : `Waiting for approval in ${name}`}
        </span>
      </div>
    );
  }

  function renderConnected() {
    const addr = publicKey?.toBase58() ?? '';
    return (
      <div className="mw-center">
        {walletVisual(
          activeAdapterIndex,
          <>
            <span className="mw-burst" />
            <span className="mw-badge mw-badge-ok">
              <CheckIcon size={16} strokeWidth={2.6} />
            </span>
          </>
        )}
        <h3 className="mw-h" role="status">
          You're connected
        </h3>
        {addr && (
          <span className="mw-addr">
            <Avatar address={addr} size={24} />
            {shortAddress(addr)}
          </span>
        )}
      </div>
    );
  }

  function renderError(v: Extract<View, { name: 'error' }>) {
    const name = viewWalletName;
    const rejected = v.reason === 'rejected';
    return (
      <div className="mw-center">
        <div className="mw-shake">
          {walletVisual(
            v.index,
            <span className="mw-badge mw-badge-bad">{rejected ? <CloseIcon size={15} strokeWidth={2.6} /> : <AlertIcon size={16} />}</span>
          )}
        </div>
        <h3 className="mw-h" role="alert">
          {rejected ? 'Request declined' : "Couldn't connect"}
        </h3>
        <p className="mw-p">
          {rejected ? `The connection was declined in ${name}. Try again whenever you're ready.` : v.message || `Something went wrong talking to ${name}.`}
        </p>
        <div className="mw-actions">
          <button type="button" className="mw-btn mw-btn-primary mw-btn-block" onClick={retry} data-mw-autofocus="">
            <RefreshIcon size={16} /> Try again
          </button>
          <button type="button" className="mw-btn mw-btn-ghost" onClick={() => go({ name: 'picker' }, 'reset')}>
            Choose another wallet
          </button>
        </div>
      </div>
    );
  }

  function renderOpenInApp() {
    const here = typeof window !== 'undefined' ? window.location.href : '';
    const custom = props.mobileDeepLink && props.mobileDeepLink !== 'morsel://connect' ? props.mobileDeepLink : null;
    const href = custom ?? (here ? morselBrowseLink(here, window.location.origin) : links.install);
    return (
      <div className="mw-center">
        <div className="mw-orbit">
          <img className="mw-logo-img" data-mw-shared={SHARED_MORSEL} src={MORSEL_LOGO_DATA_URI} alt="" width={72} height={72} draggable={false} style={{ width: 72, height: 72 }} />
        </div>
        <h3 className="mw-h">Continue in Morsel</h3>
        <p className="mw-p">This site opens in the Morsel app, where your wallet connects in one tap. Your keys never leave your phone.</p>
        <div className="mw-actions">
          <a className="mw-btn mw-btn-primary mw-btn-lg mw-btn-block" href={href} data-mw-autofocus="">
            Open in Morsel
          </a>
          <button type="button" className="mw-btn mw-btn-ghost" onClick={() => go({ name: 'get' })}>
            I don't have Morsel yet
          </button>
        </div>
      </div>
    );
  }

  function renderGet() {
    const props3 = [
      { icon: <ShieldIcon size={17} />, t: 'Your keys, your crypto', s: 'Self-custody. No email, no sign-up.' },
      { icon: <BoltIcon size={17} />, t: 'Trade, bridge and earn', s: 'Cookie Chain and Solana in one app.' },
      { icon: <CompassIcon size={17} />, t: 'Open any app', s: 'A built-in browser, already connected.' },
    ];
    return (
      <>
        <div className="mw-get-art" aria-hidden="true">
          <span className="mw-get-ring" />
          <span className="mw-get-ring" />
          <span className="mw-chip-float" style={{ left: '12%', top: 18, animationDelay: '-1.5s' }}>
            <i style={{ background: 'linear-gradient(135deg,#ffd27a,#e89b2c)' }} />
            COOK
          </span>
          <span className="mw-chip-float" style={{ right: '12%', top: 62, animationDelay: '-3.5s' }}>
            <i style={{ background: 'linear-gradient(135deg,#9945ff,#14f195)' }} />
            SOL
          </span>
          <span className="mw-get-logo">
            <img className="mw-logo-img" data-mw-shared={SHARED_MORSEL} src={MORSEL_LOGO_DATA_URI} alt="" width={76} height={76} draggable={false} />
          </span>
        </div>
        <h3 className="mw-get-h">Morsel Wallet</h3>
        <p className="mw-get-p">The self-custody wallet built for Cookie Chain, with Solana on board.</p>
        <ul className="mw-props">
          {props3.map((p, n) => (
            <li key={p.t} className="mw-prop mw-stagger" style={{ ['--i' as string]: n + 1 }}>
              <span className="mw-prop-ico">{p.icon}</span>
              <span>
                <b>{p.t}</b>
                <small>{p.s}</small>
              </span>
            </li>
          ))}
        </ul>
        {mobile ? (
          <div className="mw-stores mw-stagger" style={{ ['--i' as string]: 4 }}>
            {(ios
              ? [
                  { href: links.ios, icon: <AppleGlyph size={17} />, label: 'iOS' },
                  { href: links.android, icon: <PlayGlyph size={16} />, label: 'Android' },
                ]
              : [
                  { href: links.android, icon: <PlayGlyph size={16} />, label: 'Android' },
                  { href: links.ios, icon: <AppleGlyph size={17} />, label: 'iOS' },
                ]
            ).map((s) => (
              <a key={s.label} className="mw-store" href={s.href} target="_blank" rel="noopener noreferrer">
                {s.icon} Get for {s.label}
              </a>
            ))}
          </div>
        ) : (
          <div className="mw-dl mw-stagger" style={{ ['--i' as string]: 4 }}>
            <div className="mw-dl-qr">
              <QrCode value={links.install} size={92} ecc="M" label="QR code to download Morsel" />
            </div>
            <div className="mw-dl-side">
              <p>Scan with your phone, or pick a platform.</p>
              <a className="mw-store" href={links.ios} target="_blank" rel="noopener noreferrer">
                <AppleGlyph size={15} /> iOS <small>iPhone</small>
              </a>
              <a className="mw-store" href={links.android} target="_blank" rel="noopener noreferrer">
                <PlayGlyph size={14} /> Android <small>Phone</small>
              </a>
              <a className="mw-store" href={links.extension} target="_blank" rel="noopener noreferrer">
                <ChromeGlyph size={14} /> Chrome <small>Extension</small>
              </a>
            </div>
          </div>
        )}
        <div className="mw-more-link">
          <a className="mw-btn mw-btn-ghost" href={links.website} target="_blank" rel="noopener noreferrer">
            Learn more at morselwallet.app <ExternalIcon size={13} />
          </a>
        </div>
      </>
    );
  }
}

interface RowShared {
  activeIndex: number;
  onWallet: (index: number) => void;
  installLabel: string;
}

function WalletRow({ adapter, index, order, activeIndex, onWallet, installLabel }: { adapter: CookieWalletAdapter; index: number; order: number } & RowShared) {
  const installed = adapter.readyState === 'Installed';
  return (
    <button type="button" className="mw-row mw-stagger" style={{ ['--i' as string]: order }} onClick={() => onWallet(index)} data-mw-nav="">
      <img className="mw-row-icon" src={walletIcon(adapter)} alt="" width={34} height={34} />
      <span className="mw-row-name">{displayWalletName(adapter.name)}</span>
      <span className="mw-row-meta">
        {index === activeIndex ? (
          <>
            <span className="mw-dot" />
            Connected
          </>
        ) : installed ? (
          'Detected'
        ) : (
          <>
            {installLabel} <ExternalIcon size={13} />
          </>
        )}
      </span>
    </button>
  );
}

function MoreView({ adapters, morselIndex, rowProps }: { adapters: CookieWalletAdapter[]; morselIndex: number; rowProps: RowShared }) {
  const [q, setQ] = useState('');
  const list = adapters
    .map((a, i) => ({ a, i }))
    .filter((x) => x.i !== morselIndex)
    .sort((x, y) => Number(y.a.readyState === 'Installed') - Number(x.a.readyState === 'Installed'));
  const needle = q.trim().toLowerCase();
  const filtered = list.filter((x) => !needle || x.a.name.toLowerCase().includes(needle));
  return (
    <>
      {list.length > 6 && (
        <label className="mw-search">
          <SearchIcon size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search wallets" aria-label="Search wallets" />
        </label>
      )}
      <div className="mw-scroll">
        <div className="mw-list">
          {filtered.length === 0 && <div className="mw-empty">No wallets found</div>}
          {filtered.map(({ a, i }, n) => (
            <WalletRow key={i} adapter={a} index={i} order={n} {...rowProps} />
          ))}
        </div>
      </div>
    </>
  );
}

function NetworkSwitch({
  networks,
  selectedNetworkId,
  onNetworkChange,
}: Pick<WalletModalProps, 'selectedNetworkId' | 'onNetworkChange'> & { networks: NonNullable<WalletModalProps['networks']> }) {
  const [local, setLocal] = useState(selectedNetworkId ?? networks[0]?.id);
  const selected = selectedNetworkId ?? local;
  return (
    <div className="mw-seg" role="group" aria-label="Network">
      {networks.map((n) => (
        <button
          key={n.id}
          type="button"
          aria-pressed={n.id === selected}
          onClick={() => {
            setLocal(n.id);
            onNetworkChange?.(n.id);
          }}
        >
          {n.icon && <img src={n.icon} alt="" width={16} height={16} />}
          {n.name}
        </button>
      ))}
    </div>
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')
  ).filter((el) => !el.closest('.mw-ghost') && el.offsetParent !== null);
}

function focusView(v: HTMLElement, initial = false) {
  const target =
    v.querySelector<HTMLElement>('[data-mw-autofocus]') ?? (initial ? v.querySelector<HTMLElement>('[data-mw-nav]') : null) ?? v;
  try {
    target.focus({ preventScroll: true } as FocusOptions);
  } catch {
    /* ignore */
  }
}
