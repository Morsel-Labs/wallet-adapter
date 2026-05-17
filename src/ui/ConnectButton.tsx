import React, { useCallback } from 'react';
import { useWalletConnection } from '../react';
import { useWalletAddress } from '../react';
import { useOptionalWalletModal } from './WalletModalProvider';
import { ConnectButtonProps } from './types';

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function ConnectButton({
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
  const { connect, disconnect, connected, connecting, disconnecting, pending } = useWalletConnection();
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
    if (showAddress && address) {
      label = shortenAddress(address);
    } else {
      label = connectedLabel;
    }
  } else {
    label = disconnectedLabel;
  }

  const isDisabled = disabled || pending;

  if (children) {
    return (
      <button
        type="button"
        className={className}
        disabled={isDisabled}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {label}
    </button>
  );
}
