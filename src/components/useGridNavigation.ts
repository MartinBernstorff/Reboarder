import { useCallback } from 'react';

export function useListNavigation(itemCount: number) {
	const navigate = useCallback((direction: 'up' | 'down', currentIndex: number): number | null => {
		switch (direction) {
			case 'down':
				return currentIndex + 1 <= itemCount - 1 ? currentIndex + 1 : null;
			case 'up':
				return currentIndex - 1 >= 0 ? currentIndex - 1 : null;
		}
	}, [itemCount]);

	return navigate;
}
