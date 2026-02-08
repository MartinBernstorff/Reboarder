import { useContext } from 'react';
import { PluginContext } from './contexts';
import type ReboarderPlugin from 'src/ReboarderPlugin';

export const usePlugin = (): ReboarderPlugin => {
	const plugin = useContext(PluginContext);
	if (!plugin) {
		throw new Error('usePlugin must be used within a PluginContext.Provider');
	}
	return plugin;
};
