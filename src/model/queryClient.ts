import { QueryClient } from '@tanstack/react-query';

export const queryConfig = {
	queries: {
		refetchOnWindowFocus: true,
		retry: 3,
		staleTime: 1000 * 60 * 60, // 5 minutes
		cacheTime: 1000 * 60 * 60 * 24, // 24 hours
		suspense: false,
		useErrorBoundary: false,
	},
};

export const queryClient = new QueryClient({
	defaultOptions: queryConfig,
});
