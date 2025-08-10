import { useContext } from 'react';
import { AppContext, PluginContext } from './context';
import { App } from 'obsidian';
import ReboarderPlugin from './main';

export const useApp = (): App => {
  const app = useContext(AppContext);
  if (!app) {
    throw new Error('useApp must be used within an AppContext.Provider');
  }
  return app;
};

export const usePlugin = (): ReboarderPlugin => {
  const plugin = useContext(PluginContext);
  if (!plugin) {
    throw new Error('usePlugin must be used within a PluginContext.Provider');
  }
  return plugin;
};
