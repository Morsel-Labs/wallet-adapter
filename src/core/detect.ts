import { MorselCookieProvider } from './types';

function looksLikeMorselProvider(value: unknown): value is MorselCookieProvider {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as any;
  return (
    typeof candidate.connect === 'function' &&
    typeof candidate.signTransaction === 'function'
  );
}

/**
 * Detect an injected Morsel / Cookie provider on `window`.
 *
 * The Morsel extension and the Morsel in-app browser may expose the provider in several shapes:
 *   - directly:    window.morsel  (has connect/signTransaction)
 *   - namespaced:  window.morsel.cookie | window.morsel.solana (plus a legacy chain namespace)
 *   - as aliases:  window.cookie, window.dumpsack (and their namespaces)
 *
 * The Cookie Chain provider is preferred, then the root object, then `.solana`. Being tolerant of
 * the shape means the connect kit works regardless of how a given wallet build exposes itself.
 */
export function detectMorselCookieProvider(): MorselCookieProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const candidates: unknown[] = [];
  for (const root of [w.morsel, w.cookie, w.dumpsack]) {
    if (!root) continue;
    candidates.push(root.cookie, root.gorbagana, root, root.solana);
  }
  return (candidates.find(looksLikeMorselProvider) as MorselCookieProvider | undefined) ?? null;
}

export { detectStandardMorselProvider } from './standard-provider';
