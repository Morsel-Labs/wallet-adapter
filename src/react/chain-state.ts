/**
 * WalletProvider's network rules, as plain functions (tested on their own).
 */
import { resolveSvmChain, type SvmChain } from '../core/chains';
import type { WalletProviderProps } from './types';

/** The id a `chain` prop names ('solana' when it is left out). */
export const chainPropId = (chain: string | SvmChain | undefined): string =>
  chain === undefined ? 'solana' : typeof chain === 'string' ? chain : chain.id;

/** The networks offered: `offered` with the current one first when it is not among them; else just it. */
export function offeredChains(offered: SvmChain[] | null, current: SvmChain): SvmChain[] {
  if (!offered) return [current];
  return offered.some((c) => c.id === current.id) ? offered : [current, ...offered];
}

/**
 * The network setChain(key) moves to. Throws for an unknown network, and for one outside `offered`
 * when the app gave a list.
 */
export function nextChain(offered: SvmChain[] | null, key: string): SvmChain {
  const next = resolveSvmChain(key);
  if (offered && !offered.some((c) => c.id === next.id)) {
    throw new Error(`${next.name} is not one of this app's networks (${offered.map((c) => c.key).join(', ')})`);
  }
  return next;
}

/** The app's RPC for `chain`: a string is for `home` (the `chain` prop's network) only. */
export function rpcUrlFor(rpcUrl: WalletProviderProps['rpcUrl'], chain: SvmChain, home: SvmChain): string | undefined {
  if (!rpcUrl) return undefined;
  if (typeof rpcUrl === 'function') return rpcUrl(chain) || undefined;
  if (typeof rpcUrl === 'string') return chain.id === home.id ? rpcUrl : undefined;
  return rpcUrl[chain.key] ?? rpcUrl[chain.id];
}
