import React from 'react';

export interface ConnectButtonProps {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  showAddress?: boolean;
  connectingLabel?: string;
  connectedLabel?: string;
  disconnectedLabel?: string;
  useModal?: boolean;
  onConnectError?: (error: Error) => void;
  onDisconnectError?: (error: Error) => void;
}
