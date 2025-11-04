import { createContext, useContext } from 'react';
import { App } from 'obsidian';
import ReboarderPlugin from 'app/ReboarderPlugin';


export const useApp = (): App | undefined => {
  return useContext(AppContext);
};

export const AppContext = createContext<App | undefined>(undefined);
export const PluginContext = createContext<ReboarderPlugin | undefined>(undefined);

