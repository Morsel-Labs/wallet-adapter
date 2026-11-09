import { chainIdsOf, type SvmChain } from './chains';

/**
 * The id to hand a wallet for `chain`: the first of the chain's ids the wallet advertises (Phantom
 * advertises 'solana:mainnet', Backpack the 33-character form), or the chain's own id when the wallet
 * lists no chains at all. Null when the wallet lists chains and none of them is this network.
 */
export function chainIdFor(advertised: readonly string[] | null | undefined, chain: SvmChain): string | null {
  if (!advertised || advertised.length === 0) return chain.id;
  const have = new Set(advertised);
  return chainIdsOf(chain).find((id) => have.has(id)) ?? null;
}

/**
 * Does this wallet (adapter) work on `chain`? A Wallet Standard wallet does when it advertises one of
 * the chain's ids; an adapter that does not say which chains it supports (Morsel, or one you built) is
 * taken at its word.
 */
export function walletSupportsChain(adapter: { chains?: readonly string[] } | null | undefined, chain: SvmChain): boolean {
  if (!adapter) return false;
  const chains = adapter.chains;
  if (!Array.isArray(chains)) return true;
  return chainIdFor(chains, chain) !== null;
}
