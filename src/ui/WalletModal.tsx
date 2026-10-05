import React, { useEffect } from 'react';
import { useWallet } from '../react';
import { useWalletModal } from './WalletModalProvider';
import { WalletModalProps } from './modalTypes';
import { ConnectWidget } from './kit/ConnectWidget';

/**
 * The wallet connect UI.
 *
 * - `variant="compact"` (default) and `variant="premium"` render the Morsel connect widget: a small
 *   card on desktop, a draggable bottom sheet on phones, with the QR / extension / in-app flows.
 * - `variant="headless"` renders the bare, unstyled list for apps that bring their own design.
 */
export function WalletModal(props: WalletModalProps) {
  if (props.variant === 'headless') return <HeadlessWalletModal {...props} />;
  return <ConnectWidget {...props} />;
}

function HeadlessWalletModal({
  className,
  overlayClassName,
  title = 'Morsel Wallet Connect',
  connectLabel = 'Connect',
  closeLabel = 'Close',
  installLabel = 'Install Wallet',
  onConnectError,
}: WalletModalProps) {
  const { adapters, selectAdapter, activeAdapterIndex, connected } = useWallet();
  const { visible, close } = useWalletModal();

  useEffect(() => {
    if (connected && visible) close();
  }, [connected, visible, close]);

  const handleConnect = async (adapterIndex: number) => {
    try {
      const selectedAdapter = adapters[adapterIndex];
      await selectAdapter(adapterIndex);
      await selectedAdapter.connect();
      close();
    } catch (error) {
      onConnectError?.(error as Error);
    }
  };

  const handleInstall = (adapter: (typeof adapters)[number]) => {
    if (adapter.url) window.open(adapter.url, '_blank');
  };

  if (!visible) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  };
  const modalStyle: React.CSSProperties = {
    width: 'min(560px, 100%)',
    maxHeight: '85vh',
    overflowY: 'auto',
    background: '#111827',
    color: '#f9fafb',
    border: '1px solid #374151',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
  };

  return (
    <div className={overlayClassName} style={!overlayClassName ? overlayStyle : undefined}>
      <div className={className} style={!className ? modalStyle : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {adapters.map((adapter, index) => (
          <div key={index}>
            <h3>
              {adapter.name}
              {index === activeAdapterIndex ? ' (Active)' : ''}
            </h3>
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
