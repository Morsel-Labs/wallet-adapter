export class WalletAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletAdapterError';
  }
}

export class WalletNotFoundError extends WalletAdapterError {
  constructor() {
    super('Wallet not found');
    this.name = 'WalletNotFoundError';
  }
}

export class WalletNotConnectedError extends WalletAdapterError {
  constructor() {
    super('Wallet not connected');
    this.name = 'WalletNotConnectedError';
  }
}

export class WalletConnectionError extends WalletAdapterError {
  constructor(message: string = 'Failed to connect to wallet') {
    super(message);
    this.name = 'WalletConnectionError';
  }
}

export class WalletDisconnectionError extends WalletAdapterError {
  constructor(message: string = 'Failed to disconnect from wallet') {
    super(message);
    this.name = 'WalletDisconnectionError';
  }
}

export class WalletSignTransactionError extends WalletAdapterError {
  constructor(message: string = 'Failed to sign transaction') {
    super(message);
    this.name = 'WalletSignTransactionError';
  }
}

export class WalletSignMessageError extends WalletAdapterError {
  constructor(message: string = 'Failed to sign message') {
    super(message);
    this.name = 'WalletSignMessageError';
  }
}
export class WalletSendTransactionError extends WalletAdapterError {
  constructor(message: string = 'Failed to send transaction') {
    super(message);
    this.name = 'WalletSendTransactionError';
  }
}

/** The wallet does not support the app's network (it does not advertise that chain). */
export class WalletChainNotSupportedError extends WalletAdapterError {
  constructor(message: string = 'The wallet does not support this network') {
    super(message);
    this.name = 'WalletChainNotSupportedError';
  }
}
