import { createContext } from 'react';
import { App } from 'obsidian';
import ReboarderPlugin from './main';

export const AppContext = createContext<App | undefined>(undefined);
export const PluginContext = createContext<ReboarderPlugin | undefined>(undefined);
