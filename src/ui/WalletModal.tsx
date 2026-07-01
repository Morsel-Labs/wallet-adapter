import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useWallet } from '../react';
import { useWalletModal } from './WalletModalProvider';
import { WalletModalProps } from './modalTypes';
import morselLogo from './assets/morsel-logo.png';
import cookieNetworkLogo from './assets/cookie.png';
import solanaNetworkLogo from './assets/solana.svg';

type WalletVisualState = 'Connected' | 'Selected' | 'Detected' | 'Not Installed' | 'Recommended';

type WalletCardModel = {
  adapter: ReturnType<typeof useWallet>['adapters'][number];
  index: number;
  isInstalled: boolean;
  isActive: boolean;
  isConnected: boolean;
  visualState: WalletVisualState;
  actionLabel: string;
  actionDisabled: boolean;
};


const SPACE = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
} as const;

const RADIUS = {
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
} as const;

const TYPE = {
  modalTitle: { fontSize: 18, fontWeight: 600 as const, lineHeight: '24px' },
  sectionTitle: { fontSize: 16, fontWeight: 650 as const, lineHeight: '24px' },
  walletName: { fontSize: 15, fontWeight: 600 as const, lineHeight: '20px' },
  body: { fontSize: 14, fontWeight: 400 as const, lineHeight: '20px', letterSpacing: '0.01em' },
  helper: { fontSize: 13, fontWeight: 400 as const, lineHeight: '18px' },
  tiny: { fontSize: 12, fontWeight: 500 as const, lineHeight: '16px' },
} as const;

const LAYOUT = {
  modalMaxWidth: 860,
  modalMinHeight: 520,
  headerHeight: 60,
  leftColumnWidth: '46%',
  rightColumnWidth: '54%',
  qrSize: 220,
  rowMinHeight: 64,
  iconSize: 40,
  primaryButtonHeight: 38,
  secondaryButtonHeight: 32,
} as const;

const defaultNetworks = [
  { id: 'cookie-chain', name: 'Cookie Chain', icon: cookieNetworkLogo },
  { id: 'solana', name: 'Solana', icon: solanaNetworkLogo },
];

const neutralWalletFallbackIcon =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%23dbe5f5"/><stop offset="1" stop-color="%23cbd5e1"/></linearGradient></defs><rect width="80" height="80" rx="18" fill="url(%23g)"/><path d="M23 31h34c4 0 7 3 7 7v11c0 4-3 7-7 7H23c-4 0-7-3-7-7V38c0-4 3-7 7-7z" fill="%2364758b"/><circle cx="54" cy="43" r="3" fill="%23e2e8f0"/></svg>';

const placeholderWalletIconPrefix = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQi';

function isPlaceholderWalletIcon(icon: string | undefined): boolean {
  return !!icon && icon.startsWith(placeholderWalletIconPrefix);
}

function getImportedWalletIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('morsel')) return morselLogo;
  return neutralWalletFallbackIcon;
}

function getResolvedWalletIcon(name: string, icon?: string): string {
  if (icon && !isPlaceholderWalletIcon(icon)) return icon;
  return getImportedWalletIcon(name);
}

function getThemeTokens(isLight: boolean) {
  if (isLight) {
    return {
      overlay: 'rgba(244, 247, 251, 0.88)',
      shell: '#fbfcff',
      baseSurface: '#fbfcff',
      elevatedSurface: '#ffffff',
      hoverSurface: '#ffffff',
      inputSurface: '#ffffff',
      inputBorder: 'rgba(148, 163, 184, 0.14)',
      chipBg: 'rgba(79, 124, 255, 0.08)',
      chipBorder: 'rgba(79, 124, 255, 0.12)',
      qrTileBg: '#ffffff',
      closeBg: 'rgba(255,255,255,0.6)',
      closeBorder: 'rgba(148, 163, 184, 0.12)',
      barSurface: 'linear-gradient(180deg, rgba(250,251,255,0.98), rgba(245,247,252,0.96))',
      leftSurface: 'radial-gradient(circle at 36% 20%, rgba(96,165,250,0.08), transparent 52%), #fbfcff',
      rightSurface: '#fbfcff',
      textPrimary: '#0f172a',
      textSecondary: '#56657b',
      textMuted: '#77879c',
      border: 'rgba(148, 163, 184, 0.12)',
      borderStrong: 'rgba(148, 163, 184, 0.18)',
      accent: '#4f7cff',
      accentSoft: 'rgba(79, 124, 255, 0.10)',
      success: '#16a34a',
      successSoft: 'rgba(22, 163, 74, 0.10)',
      mutedSoft: 'rgba(100, 116, 139, 0.06)',
      shellShadow: '0 26px 70px rgba(15, 23, 42, 0.18)',
      tileShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
      rowShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
    };
  }

  return {
    overlay: 'rgba(5, 9, 20, 0.78)',
    shell: '#0a1120',
    baseSurface: '#0a1120',
      elevatedSurface: 'rgba(255, 255, 255, 0.03)',
      hoverSurface: 'rgba(255, 255, 255, 0.05)',
      inputSurface: '#0d1628',
      inputBorder: 'rgba(148, 163, 184, 0.12)',
      chipBg: 'rgba(96, 165, 250, 0.12)',
      chipBorder: 'rgba(96, 165, 250, 0.16)',
      qrTileBg: '#ffffff',
      closeBg: 'rgba(255,255,255,0.03)',
      closeBorder: 'rgba(148, 163, 184, 0.1)',
      barSurface: 'linear-gradient(180deg, rgba(20, 28, 46, 0.98), rgba(24, 29, 54, 0.96))',
      leftSurface: 'radial-gradient(circle at 36% 20%, rgba(96,165,250,0.08), transparent 52%), #0a1120',
      rightSurface: '#0a1120',
    textPrimary: '#e2e8f0',
    textSecondary: '#a7b4c9',
    textMuted: '#8797ae',
    border: 'rgba(148, 163, 184, 0.07)',
    borderStrong: 'rgba(148, 163, 184, 0.12)',
    accent: '#60a5fa',
    accentSoft: 'rgba(96, 165, 250, 0.12)',
    success: '#34d399',
    successSoft: 'rgba(52, 211, 153, 0.12)',
    mutedSoft: 'rgba(148, 163, 184, 0.05)',
    shellShadow: '0 28px 80px rgba(2, 6, 23, 0.40)',
    tileShadow: '0 14px 28px rgba(2, 6, 23, 0.18)',
    rowShadow: '0 10px 20px rgba(2, 6, 23, 0.10)',
  };
}

function getStatusBadgeStyle(state: WalletVisualState): React.CSSProperties {
  const palette = {
    Connected: { bg: 'rgba(22, 163, 74, 0.10)', color: '#16a34a', border: 'rgba(22, 163, 74, 0.18)' },
    Detected: { bg: 'rgba(79, 124, 255, 0.10)', color: '#4f7cff', border: 'rgba(79, 124, 255, 0.18)' },
    Selected: { bg: 'rgba(79, 124, 255, 0.08)', color: '#4f7cff', border: 'rgba(79, 124, 255, 0.16)' },
    Recommended: { bg: 'rgba(107, 70, 193, 0.12)', color: '#6b46c1', border: 'rgba(107, 70, 193, 0.24)' },
    'Not Installed': { bg: 'rgba(100, 116, 139, 0.08)', color: '#77879c', border: 'rgba(100, 116, 139, 0.14)' },
  }[state];

  return {
    display: 'inline-flex',
    alignItems: 'center',
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    color: palette.color,
    borderRadius: RADIUS[8],
    padding: '2px 7px',
    fontSize: 11,
    fontWeight: 500,
    lineHeight: '14px',
  };
}

export function WalletModal({
  className,
  overlayClassName,
  variant = 'headless',
  theme = 'system',
  title = 'Morsel Wallet Connect',
  subtitle = 'Choose a wallet and network to continue',
  logo,
  showPoweredBy = false,
  networks,
  selectedNetworkId,
  onNetworkChange,
  mobileDeepLink = 'morsel://connect',
  connectLabel = 'Connect',
  closeLabel = 'Close',
  installLabel = 'Install Wallet',
  onConnectError,
}: WalletModalProps) {
  const { adapters, selectAdapter, activeAdapterIndex, connected, publicKey, connecting } = useWallet();
  const { visible, close } = useWalletModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [localSelectedNetworkId, setLocalSelectedNetworkId] = useState(defaultNetworks[0].id);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [wcUri, setWcUri] = useState<string>('');
  const [qrExpiry, setQrExpiry] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [prefersLight, setPrefersLight] = useState(false);
  const [showAllWallets, setShowAllWallets] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (visible) {
      setShowAllWallets(false);
      setFolderOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (connected && visible) close();
  }, [connected, visible]);

  // Track live wc: URI from the Morsel adapter
  useEffect(() => {
    const morselAdapter = adapters.find(a => a.name.toLowerCase().includes('morsel')) as any;
    if (!morselAdapter) return;
    if (morselAdapter.wcUri) setWcUri(morselAdapter.wcUri);
    const handler = (uri: string) => setWcUri(uri);
    morselAdapter.on?.('wcUriChange', handler);
    return () => morselAdapter.off?.('wcUriChange', handler);
  }, [adapters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => setPrefersLight(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const qrContent = wcUri || mobileDeepLink;
    if (!qrContent) return;
    // Clear old QR immediately so skeleton shows while new one renders
    setQrDataUrl('');
    if (wcUri) {
      setQrExpiry(Date.now() + 5 * 60 * 1000);
      setTimeLeft(300);
    }
    let disposed = false;
    QRCode.toDataURL(qrContent, {
      width: LAYOUT.qrSize * 2,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url: string) => { if (!disposed) setQrDataUrl(url); })
      .catch(() => { if (!disposed) setQrDataUrl(''); });
    return () => { disposed = true; };
  }, [wcUri, mobileDeepLink]);

  // Countdown timer
  useEffect(() => {
    if (!qrExpiry) return;
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((qrExpiry - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [qrExpiry]);

  const effectiveNetworks = networks && networks.length > 0 ? networks : defaultNetworks;
  const networkId = selectedNetworkId ?? localSelectedNetworkId;
  const selectedNetwork =
    effectiveNetworks.find((network) => network.id === networkId) ?? effectiveNetworks[0] ?? defaultNetworks[0];

  useEffect(() => {
    if (!onNetworkChange && selectedNetworkId) {
      setLocalSelectedNetworkId(selectedNetworkId);
    }
  }, [selectedNetworkId, onNetworkChange]);


  const connectedAddressPreview = connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null;

  const walletCards: WalletCardModel[] = useMemo(
    () =>
      adapters.map((adapter, index) => {
        const isInstalled = adapter.readyState === 'Installed';
        const isActive = index === activeAdapterIndex;
        const isConnected = isActive && connected;
        const visualState: WalletVisualState = isConnected
          ? 'Connected'
          : isInstalled
            ? 'Detected'
            : isActive
              ? 'Selected'
              : 'Not Installed';

        return {
          adapter,
          index,
          isInstalled,
          isActive,
          isConnected,
          visualState,
          actionLabel: isConnected ? 'Connected' : isInstalled ? connectLabel : installLabel,
          actionDisabled: connecting || isConnected,
        };
      }),
    [adapters, activeAdapterIndex, connected, connectLabel, connecting, installLabel]
  );

  // Show every detected Solana wallet — no network gating. Only the search box filters.
  const filteredCards = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return walletCards.filter(({ adapter }) => {
      const name = adapter.name.toLowerCase();
      return !search || name.includes(search);
    });
  }, [walletCards, searchTerm]);

  const handleConnect = async (adapterIndex: number) => {
    try {
      const selectedAdapter = adapters[adapterIndex];
      await selectAdapter(adapterIndex);
      await selectedAdapter.connect();
      close();
    } catch (error) {
      if (onConnectError) {
        onConnectError(error as Error);
      }
    }
  };

  const handleInstall = (adapter: (typeof adapters)[number]) => {
    if (adapter.url) {
      window.open(adapter.url, '_blank');
    }
  };

  const handleCardAction = (card: WalletCardModel) => {
    if (card.actionDisabled) return;
    // Morsel is always connectable (QR / relay), so never route it to an install page.
    const isMorselCard = card.adapter.name.toLowerCase().includes('morsel');
    if (card.isInstalled || isMorselCard) {
      void handleConnect(card.index);
      return;
    }
    handleInstall(card.adapter);
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: `${SPACE[16]}px`,
  };

  const modalStyle: React.CSSProperties = {
    width: 'min(560px, 100%)',
    maxHeight: '85vh',
    overflowY: 'auto',
    background: '#111827',
    color: '#f9fafb',
    border: '1px solid #374151',
    borderRadius: `${RADIUS[12]}px`,
    padding: `${SPACE[16]}px`,
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
  };

  if (!visible) return null;

  if (variant === 'premium') {
    const isLight = theme === 'light' || (theme === 'system' && prefersLight);
    const t = getThemeTokens(isLight);
    const networkLogo = selectedNetwork.icon || (selectedNetwork.id === 'solana' ? solanaNetworkLogo : cookieNetworkLogo);
    const networkAccent = selectedNetwork.id === 'solana' ? '#14f195' : t.accent;

    const LockIcon = () => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );

    const StarIcon = () => (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );

    const WalletRow = ({ card, mobile = false }: { card: WalletCardModel; mobile?: boolean }) => {
      const isHovered = !mobile && hoveredIndex === card.index;
      const icon = getResolvedWalletIcon(card.adapter.name, card.adapter.icon);
      const isMorselCard = card.adapter.name.toLowerCase().includes('morsel');
      // Morsel connects via the QR / relay session even without a browser extension,
      // so it is ALWAYS connectable — never show "Install" for it.
      const morselHighlight = isMorselCard && !card.isConnected;
      const displayBadge = isMorselCard ? 'Recommended' : card.visualState;
      const displayAction = card.isConnected
        ? card.actionLabel
        : isMorselCard
          ? connectLabel
          : card.isInstalled
            ? card.actionLabel
            : 'Install';
      const displayActionColor = morselHighlight ? '#ffffff' : (card.isConnected ? t.success : card.isInstalled ? t.accent : t.textMuted);
      const displayActionBg = morselHighlight ? '#5b5bf7' : (card.isConnected ? t.successSoft : card.isInstalled ? t.accentSoft : t.mutedSoft);
      const displayActionBorder = morselHighlight ? '#5b5bf7' : (card.isConnected ? t.successSoft : card.isInstalled ? t.accentSoft : t.border);
      const tileActive = card.isConnected || card.isActive;
      const displayName = card.adapter.name === 'Morsel Cookie Wallet' ? 'Morsel Wallet' : card.adapter.name;

      if (mobile) {
        return (
          <div
            key={card.index}
            onClick={() => handleCardAction(card)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: `${SPACE[12]}px ${SPACE[20]}px`,
              gap: `${SPACE[16]}px`,
              cursor: card.actionDisabled ? 'default' : 'pointer',
              borderBottom: `1px solid ${t.border}`,
              background: card.isConnected ? t.successSoft : 'transparent',
              transition: 'background 120ms ease',
            }}
          >
            <img src={icon} alt={displayName} style={{ width: '44px', height: '44px', borderRadius: `${RADIUS[12]}px`, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ ...TYPE.walletName, color: t.textPrimary }}>{displayName}</span>
                {isMorselCard && <StarIcon />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: `${SPACE[8]}px`, marginTop: '3px' }}>
                <span style={getStatusBadgeStyle(displayBadge as WalletVisualState)}>{displayBadge}</span>
                {card.isConnected && connectedAddressPreview && (
                  <span style={{ ...TYPE.tiny, color: t.textMuted }}>{connectedAddressPreview}</span>
                )}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        );
      }

      return (
        <div
          key={card.index}
          onMouseEnter={() => setHoveredIndex(card.index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => handleCardAction(card)}
          style={{
            minHeight: `${LAYOUT.rowMinHeight}px`,
            padding: `${SPACE[8]}px ${SPACE[12]}px`,
            borderRadius: `${RADIUS[16]}px`,
            border: `1px solid ${tileActive ? t.borderStrong : t.border}`,
            background: isHovered ? t.hoverSurface : t.elevatedSurface,
            boxShadow: isHovered ? t.rowShadow : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE[12]}px`,
            cursor: card.actionDisabled ? 'default' : 'pointer',
            transition: 'background 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
          }}
        >
          <div style={{
            width: `${LAYOUT.iconSize}px`,
            height: `${LAYOUT.iconSize}px`,
            borderRadius: `${RADIUS[16]}px`,
            background: t.baseSurface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <img src={icon} alt={displayName} style={{ width: '36px', height: '36px', borderRadius: `${RADIUS[12]}px`, objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${SPACE[4]}px` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ ...TYPE.walletName, color: t.textPrimary }}>{displayName}</span>
              {isMorselCard && <StarIcon />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `${SPACE[8]}px`, flexWrap: 'wrap' }}>
              <span style={getStatusBadgeStyle(displayBadge as WalletVisualState)}>{displayBadge}</span>
              {card.isConnected && connectedAddressPreview && (
                <span style={{ ...TYPE.tiny, color: t.textMuted }}>{connectedAddressPreview}</span>
              )}
            </div>
          </div>
          <div style={{
            height: `${LAYOUT.secondaryButtonHeight}px`,
            padding: `0 ${SPACE[16]}px`,
            borderRadius: `${RADIUS[20]}px`,
            border: `1px solid ${displayActionBorder}`,
            background: displayActionBg,
            color: displayActionColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            ...TYPE.tiny,
            fontWeight: 600,
          }}>
            {displayAction}
          </div>
        </div>
      );
    };

    // ── MOBILE: bottom sheet ─────────────────────────────────
    if (isMobile) {
      const iconBtnStyle: React.CSSProperties = {
        width: 36, height: 36, borderRadius: '50%',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)'}`,
        background: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.11)',
        color: t.textPrimary,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
      };

      const dragHandle = (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: t.borderStrong }} />
        </div>
      );

      const footer = (
        <div style={{
          padding: `10px ${SPACE[20]}px`,
          borderTop: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${SPACE[4]}px`,
          color: t.textMuted, fontSize: 11, flexShrink: 0,
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}>
          <LockIcon />
          <span>Your wallet will only connect to this site.</span>
        </div>
      );

      return (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxHeight: '88vh',
              background: t.shell,
              borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.28)',
            }}
          >
            {dragHandle}
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 4px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={typeof logo === 'string' ? logo : morselLogo} alt="Morsel" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                <span style={{ fontSize: 16, fontWeight: 650, color: t.textPrimary }}>Connect your wallet</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href="https://connect.morselwallet.app" target="_blank" rel="noreferrer" aria-label="Help" style={{ ...iconBtnStyle, textDecoration: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </a>
                <button onClick={close} aria-label="Close" style={iconBtnStyle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            {/* wallet grid */}
            <div style={{ overflowY: 'auto', flex: 1, padding: `${SPACE[16]}px ${SPACE[20]}px` }}>
              {filteredCards.length === 0 ? (
                <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 14, padding: `${SPACE[32]}px 0` }}>No wallets found</div>
              ) : (() => {
                const MAX_GRID = 7;
                const hiddenGridCards = filteredCards.length > MAX_GRID ? filteredCards.slice(MAX_GRID) : [];
                const visibleGridCards = filteredCards.length > MAX_GRID ? filteredCards.slice(0, MAX_GRID) : filteredCards;
                const gridCards = folderOpen ? hiddenGridCards : visibleGridCards;

                const WalletGridItem = ({ card }: { card: WalletCardModel }) => {
                  const icon = getResolvedWalletIcon(card.adapter.name, card.adapter.icon);
                  const isMorselCard = card.adapter.name.toLowerCase().includes('morsel');
                  const displayName = card.adapter.name === 'Morsel Cookie Wallet' ? 'Morsel' : card.adapter.name;
                  return (
                    <div
                      key={card.index}
                      onClick={() => handleCardAction(card)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '10px 4px', borderRadius: `${RADIUS[12]}px`, position: 'relative' }}
                    >
                      {isMorselCard && (
                        <div style={{ position: 'absolute', top: 8, right: 8 }}>
                          <StarIcon />
                        </div>
                      )}
                      <img src={icon} alt={displayName} style={{ width: 60, height: 60, borderRadius: `${RADIUS[16]}px`, objectFit: 'cover', boxShadow: t.tileShadow }} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: t.textSecondary, textAlign: 'center', lineHeight: '14px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </span>
                      {card.isConnected && (
                        <div style={{ position: 'absolute', top: 8, left: 8, width: 8, height: 8, borderRadius: '50%', background: t.success, boxShadow: `0 0 0 2px ${t.shell}` }} />
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {folderOpen && (
                      <button
                        onClick={() => setFolderOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: t.accent, fontSize: 13, fontWeight: 600,
                          padding: 0, marginBottom: SPACE[12],
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Back
                      </button>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${SPACE[8]}px` }}>
                      {gridCards.map(card => <WalletGridItem key={card.index} card={card} />)}
                      {!folderOpen && hiddenGridCards.length > 0 && (
                        <div
                          onClick={() => setFolderOpen(true)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '10px 4px', borderRadius: `${RADIUS[12]}px` }}
                        >
                          <div style={{
                            width: 60, height: 60, borderRadius: `${RADIUS[16]}px`,
                            background: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.09)',
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2,
                            padding: 4, boxShadow: t.tileShadow, overflow: 'hidden',
                          }}>
                            {hiddenGridCards.slice(0, 4).map((c, i) => (
                              <img
                                key={i}
                                src={getResolvedWalletIcon(c.adapter.name, c.adapter.icon)}
                                alt=""
                                style={{ width: '100%', height: '100%', borderRadius: 6, objectFit: 'cover' }}
                              />
                            ))}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: t.accent, textAlign: 'center', lineHeight: '14px' }}>
                            +{hiddenGridCards.length} more
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            {footer}
          </div>
        </div>
      );
    }

    // ── DESKTOP: two-column ──────────────────────────────────
    return (
      <div
        className={overlayClassName}
        style={!overlayClassName ? {
          position: 'fixed', inset: 0,
          background: t.overlay,
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          padding: `${SPACE[20]}px`,
        } : undefined}
      >
        <div
          className={className}
          style={!className ? {
            width: `min(${LAYOUT.modalMaxWidth}px, 100%)`,
            minHeight: `${LAYOUT.modalMinHeight}px`,
            maxHeight: '90vh',
            overflow: 'hidden',
            borderRadius: `${RADIUS[24]}px`,
            border: `1px solid ${t.border}`,
            background: t.shell,
            color: t.textPrimary,
            boxShadow: t.shellShadow,
            display: 'flex',
            flexDirection: 'column',
          } : undefined}
        >
          {/* header */}
          <div style={{
            height: `${LAYOUT.headerHeight}px`,
            padding: `0 ${SPACE[20]}px`,
            borderBottom: `1px solid ${t.border}`,
            background: t.barSurface,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: `${SPACE[12]}px` }}>
              <img src={typeof logo === 'string' ? logo : morselLogo} alt="Morsel" style={{ width: '32px', height: '32px', borderRadius: `${RADIUS[12]}px`, objectFit: 'cover' }} />
              <div style={{ ...TYPE.modalTitle, color: t.textPrimary }}>Morsel Wallet</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `${SPACE[12]}px` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: `${SPACE[4]}px` }}>
                <a href="https://connect.morselwallet.app" target="_blank" rel="noreferrer" style={{ ...TYPE.tiny, color: t.accent, textDecoration: 'none' }}>More info ↗</a>
                <span style={{ ...TYPE.tiny, color: t.textMuted }}>connect.morselwallet.app</span>
              </div>
              <button onClick={close} aria-label="Close" style={{
                height: `${LAYOUT.secondaryButtonHeight}px`, width: `${LAYOUT.secondaryButtonHeight}px`,
                padding: '0', borderRadius: `${RADIUS[20]}px`,
                border: `1px solid ${t.closeBorder}`, background: t.closeBg,
                color: t.textPrimary, ...TYPE.body, cursor: 'pointer',
              }}>×</button>
            </div>
          </div>

          {/* body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* left — QR */}
            <div style={{
              width: LAYOUT.leftColumnWidth, flexShrink: 0,
              padding: `${SPACE[24]}px`,
              background: t.leftSurface,
              borderRight: `1px solid ${t.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: `${SPACE[20]}px`,
            }}>
              <style>{`
                @keyframes morsel-qr-glow {
                  0%, 100% { box-shadow: ${t.tileShadow}; }
                  50% { box-shadow: 0 0 0 7px ${networkAccent}22, 0 0 36px ${networkAccent}14, ${t.tileShadow}; }
                }
                @keyframes morsel-qr-breathe {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.90; }
                }
                @keyframes morsel-spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.textPrimary, marginBottom: 6 }}>Scan with Morsel Wallet</div>
                <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: '20px' }}>Open Morsel on your phone and scan to connect.</div>
              </div>

              {/* QR tile */}
              <div style={{
                width: `${LAYOUT.qrSize}px`, height: `${LAYOUT.qrSize}px`,
                borderRadius: `${RADIUS[20]}px`, background: t.qrTileBg,
                position: 'relative', padding: `${SPACE[12]}px`, flexShrink: 0,
                animation: qrDataUrl && timeLeft > 0 ? 'morsel-qr-glow 3.5s ease-in-out infinite' : 'none',
                transition: 'box-shadow 600ms ease',
              }}>
                {/* Generating state — spinner + label */}
                {(!qrDataUrl || timeLeft === 0) && (
                  <div style={{
                    width: '100%', height: '100%',
                    borderRadius: `${RADIUS[8]}px`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      border: `2.5px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
                      borderTopColor: t.accent,
                      animation: 'morsel-spin 0.75s linear infinite',
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>Generating…</span>
                  </div>
                )}

                {/* Live QR image */}
                {qrDataUrl && timeLeft > 0 && (
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    style={{
                      width: '100%', height: '100%',
                      borderRadius: `${RADIUS[8]}px`,
                      animation: 'morsel-qr-breathe 3.5s ease-in-out infinite',
                    }}
                  />
                )}

                {/* Center logo overlay — only when QR is live */}
                {qrDataUrl && timeLeft > 0 && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 44, height: 44,
                    borderRadius: `${RADIUS[12]}px`, background: '#fff',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img src={networkLogo} alt={selectedNetwork.name} style={{ width: 28, height: 28, borderRadius: '999px' }} />
                  </div>
                )}
              </div>

              {/* Timer — only when QR is live */}
              {qrDataUrl && timeLeft > 0 && (() => {
                const mins = Math.floor(timeLeft / 60);
                const secs = String(timeLeft % 60).padStart(2, '0');
                const timerColor = timeLeft > 120 ? t.success : timeLeft > 30 ? '#f59e0b' : '#ef4444';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: timerColor, transition: 'color 1s ease' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{`Expires in ${mins}:${secs}`}</span>
                  </div>
                );
              })()}
            </div>

            {/* right — wallet list */}
            <div style={{
              flex: 1, minWidth: 0,
              padding: `${SPACE[24]}px`,
              background: t.rightSurface,
              display: 'flex', flexDirection: 'column',
              gap: `${SPACE[16]}px`, overflow: 'hidden',
            }}>
              <div style={{ fontSize: 17, fontWeight: 650, color: t.textPrimary }}>Available Wallets</div>

              {walletCards.length > 3 && (
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search wallets"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  style={{
                    height: `${LAYOUT.primaryButtonHeight}px`, width: '100%',
                    padding: `0 ${SPACE[16]}px`,
                    borderRadius: `${RADIUS[12]}px`,
                    border: `1px solid ${searchFocused ? networkAccent : t.inputBorder}`,
                    background: t.inputSurface, color: t.textPrimary,
                    boxShadow: searchFocused ? `0 0 0 4px ${networkAccent}14` : 'none',
                    ...TYPE.body, outline: 'none',
                  }}
                />
              )}

              <div style={{ display: 'grid', gap: `${SPACE[8]}px`, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {filteredCards.length === 0 ? (
                  <div style={{ ...TYPE.body, color: t.textMuted, textAlign: 'center', padding: `${SPACE[16]}px 0` }}>No wallets found</div>
                ) : (
                  filteredCards.map(card => <WalletRow key={card.index} card={card} />)
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: `${SPACE[4]}px`, color: t.textMuted, ...TYPE.tiny }}>
                <LockIcon />
                <span>Your wallet will only connect to this site.</span>
              </div>

              {showPoweredBy && <div style={{ textAlign: 'center', color: t.textMuted, ...TYPE.tiny }}>Powered by Morsel</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={overlayClassName} style={!overlayClassName ? overlayStyle : undefined}>
      <div className={className} style={!className ? modalStyle : undefined}>
        <h2>{title}</h2>
        {adapters.map((adapter, index) => (
          <div key={index}>
            <h3>{adapter.name}{index === activeAdapterIndex ? ' (Active)' : ''}</h3>
            {adapter.readyState === 'Installed' ? (
              <button onClick={() => handleConnect(index)}>{connectLabel}</button>
            ) : (
              <button onClick={() => handleInstall(adapter)}>{installLabel}</button>
            )}
          </div>
        ))}
        <button onClick={close}>{closeLabel}</button>
      </div>
    </div>
  );
}

