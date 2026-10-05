import React, { useCallback } from 'react';
import { useWalletConnection } from '../react';
import { useWalletAddress } from '../react';
import { useOptionalWalletModal } from './WalletModalProvider';
import { ConnectButtonProps } from './types';
import { AccountButton } from './kit/AccountButton';

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Connect button.
 *
 * Without `className` / `children` it is the styled Morsel button: an accent pill that opens the
 * connect widget, then a compact account chip with a Copy / Switch wallet / Disconnect menu.
 * With `className` or `children` it is the original unstyled button, unchanged.
 */
export function ConnectButton(props: ConnectButtonProps) {
  if (props.className !== undefined || props.children !== undefined) return <UnstyledConnectButton {...props} />;
  return <AccountButton {...props} />;
}

function UnstyledConnectButton({
  children,
  className,
  disabled = false,
  showAddress = false,
  connectingLabel = 'Connecting...',
  connectedLabel = 'Disconnect',
  disconnectedLabel = 'Connect Wallet',
  useModal = false,
  onConnectError,
  onDisconnectError,
}: ConnectButtonProps) {
  const { connect, disconnect, connected, connecting, pending } = useWalletConnection();
  const address = useWalletAddress();
  const modal = useOptionalWalletModal();

  const handleClick = useCallback(async () => {
    try {
      if (connected) {
        await disconnect();
      } else if (useModal && modal) {
        modal.open();
      } else {
        await connect();
      }
    } catch (error) {
      if (connected && onDisconnectError) {
        onDisconnectError(error as Error);
      } else if (!connected && onConnectError) {
        onConnectError(error as Error);
      }
    }
  }, [connected, connect, disconnect, useModal, modal, onConnectError, onDisconnectError]);

  let label: string;
  if (pending && connecting) {
    label = connectingLabel;
  } else if (connected) {
    label = showAddress && address ? shortenAddress(address) : connectedLabel;
  } else {
    label = disconnectedLabel;
  }

  return (
    <button type="button" className={className} disabled={disabled || pending} onClick={handleClick}>
      {children ?? label}
    </button>
  );
}
