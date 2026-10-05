import { MORSEL_LOGO_DATA_URI } from './logo';

export const MORSEL_COOKIE_WALLET_NAME = 'Morsel Cookie Wallet';
export const MORSEL_COOKIE_WALLET_URL = 'https://www.morselwallet.app/install';
/** The real Morsel mark as a data URI (128px WebP). */
export const MORSEL_COOKIE_WALLET_ICON = MORSEL_LOGO_DATA_URI;

/** Morsel's public website. */
export const MORSEL_WEBSITE_URL = 'https://www.morselwallet.app';

/**
 * Universal / App Link that opens a site inside Morsel's in-app browser. Append the
 * URL-encoded site and `?ref=<origin>`; see {@link morselBrowseLink}.
 */
export const MORSEL_BROWSE_LINK_BASE = 'https://morselwallet.app/ul/browse/';

/** The relay holds an unpaired session for 5 minutes, so a QR is good for that long. */
export const MORSEL_RELAY_PAIRING_TTL_MS = 5 * 60 * 1000;

/** Build the link that opens `url` inside Morsel's in-app browser. */
export function morselBrowseLink(url: string, ref?: string): string {
  let origin = ref;
  if (!origin) {
    try {
      origin = new URL(url).origin;
    } catch {
      origin = url;
    }
  }
  return `${MORSEL_BROWSE_LINK_BASE}${encodeURIComponent(url)}?ref=${encodeURIComponent(origin)}`;
}

export { MORSEL_LOGO_DATA_URI };
