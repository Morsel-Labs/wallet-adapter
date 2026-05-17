import { createContext } from 'react';
import { WalletContextState } from './types';

export const WalletContext = createContext<WalletContextState | null>(null);
