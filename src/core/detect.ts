import { MorselCookieProvider } from './types';

function looksLikeMorselProvider(value: unknown): value is MorselCookieProvider {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as any;
  return (
    typeof candidate.connect === 'function' &&
    typeof candidate.signTransaction === 'function'
  );
}

export function detectMorselCookieProvider(): MorselCookieProvider | null {
  if (typeof window === 'undefined') return null;

  const candidates = [
    (window as any).morsel?.cookie,
    (window as any).morsel,
    (window as any).dumpsack?.cookie,
    (window as any).dumpsack,
  ];

  const provider = candidates.find(looksLikeMorselProvider) ?? null;
  return provider;
}
