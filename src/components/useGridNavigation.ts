import { useCallback, type RefObject } from 'react';

export function useGridNavigation(
	itemCount: number,
	gridContainerRef: RefObject<HTMLElement | null>,
	gridSelector: string,
) {
	const getColumns = useCallback((): number => {
		const container = gridContainerRef.current?.querySelector(gridSelector);
		if (!container) return 1;
		return getComputedStyle(container).gridTemplateColumns.split(' ').length;
	}, [gridContainerRef, gridSelector]);

	const navigate = useCallback((direction: 'up' | 'down' | 'left' | 'right', currentIndex: number): number | null => {
		const cols = getColumns();
		switch (direction) {
			case 'right':
				return currentIndex + 1 <= itemCount - 1
					? currentIndex + 1
					: itemCount - 1;
			case 'left':
				return currentIndex - 1 >= 0
					? currentIndex - 1
					: 0;
			case 'down':
				return currentIndex + cols <= itemCount - 1
					? currentIndex + cols
					: null;
			case 'up':
				return currentIndex - cols >= 0
					? currentIndex - cols
					: null;
		}
	}, [getColumns, itemCount]);

	return navigate;
}
