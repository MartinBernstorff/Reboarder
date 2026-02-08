import { createContext } from 'react';
import { App } from 'obsidian';
import type ReboarderPlugin from 'src/ReboarderPlugin';

export const AppContext = createContext<App | undefined>(undefined);
export const PluginContext = createContext<ReboarderPlugin | undefined>(undefined);
