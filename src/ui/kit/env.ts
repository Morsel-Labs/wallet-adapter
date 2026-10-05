import { useEffect, useLayoutEffect, useState } from 'react';
import { detectMorselCookieProvider, detectStandardMorselProvider } from '../../core/detect';
import { MORSEL_COOKIE_WALLET_NAME } from '../../core/constants';

/** useLayoutEffect on the client, useEffect on the server (no SSR warning). */
export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function isMorselAdapterName(name: string | undefined): boolean {
  return !!name && /morsel/i.test(name);
}

export function displayWalletName(name: string): string {
  return name === MORSEL_COOKIE_WALLET_NAME ? 'Morsel' : name;
}

/** A phone or tablet (iPadOS reports a Mac UA, so touch points decide). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

/** Running inside the Morsel app's own dApp browser (it injects a native bridge). */
export function isInMorselBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.__MORSEL_BRIDGE__ || w.DumpSackBridge);
}

/** A Morsel provider is reachable right here (extension, or Morsel's in-app browser). */
export function hasInjectedMorsel(): boolean {
  try {
    return !!(detectMorselCookieProvider() ?? detectStandardMorselProvider());
  } catch {
    return false;
  }
}

function query(q: string, fallback: boolean): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return fallback;
  return window.matchMedia(q).matches;
}

/** Live media-query state; `fallback` is what the server and first client render assume. */
export function useMedia(q: string, fallback = false, readSync = false): boolean {
  // readSync: only for client-only trees (the portal), where there is no hydration to mismatch.
  const [match, setMatch] = useState(() => (readSync ? query(q, fallback) : fallback));
  useIsoLayoutEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(q);
    const update = () => setMatch(mql.matches);
    update();
    if (mql.addEventListener) mql.addEventListener('change', update);
    else mql.addListener(update);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', update);
      else mql.removeListener(update);
    };
  }, [q]);
  return match;
}

export type ThemeSetting = 'light' | 'dark' | 'system' | 'auto';

export function useResolvedTheme(theme: ThemeSetting | undefined, readSync = false): 'light' | 'dark' {
  const prefersDark = useMedia('(prefers-color-scheme: dark)', false, readSync);
  if (theme === 'light' || theme === 'dark') return theme;
  return prefersDark ? 'dark' : 'light';
}

export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Was this a user saying no (as opposed to something breaking)? */
export function isUserRejection(error: unknown): boolean {
  const e = error as { code?: number; message?: string; name?: string } | null;
  if (!e) return false;
  if (e.code === 4001) return true;
  return /reject|denied|declin|cancel|closed by user|user abort/i.test(`${e.name ?? ''} ${e.message ?? ''}`);
}

/** Short, human error text; never raw stack traces or giant payloads. */
export function friendlyError(error: unknown): string | undefined {
  const msg = (error as { message?: string } | null)?.message;
  if (!msg || typeof msg !== 'string') return undefined;
  const clean = msg.replace(/\s+/g, ' ').trim();
  if (!clean || clean === 'Unknown error') return undefined;
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Deterministic, pleasant gradient avatar for an address. CSS only, no network. */
export function avatarBackground(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  const h1 = u % 360;
  const h2 = (h1 + 40 + ((u >>> 9) % 80)) % 360;
  const h3 = (h1 + 180 + ((u >>> 17) % 60)) % 360;
  const ang = (u >>> 3) % 360;
  const px = 20 + ((u >>> 12) % 60);
  const py = 15 + ((u >>> 20) % 50);
  return (
    `radial-gradient(circle at ${px}% ${py}%, hsl(${h3} 95% 78% / .95), transparent 55%),` +
    `linear-gradient(${ang}deg, hsl(${h1} 85% 58%), hsl(${h2} 80% 48%))`
  );
}

export function formatBalance(value: number): string {
  if (!isFinite(value)) return '';
  const abs = Math.abs(value);
  try {
    if (abs >= 100000) {
      return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs === 0 ? 0 : 4;
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
  } catch {
    return String(Math.round(value * 100) / 100);
  }
}
