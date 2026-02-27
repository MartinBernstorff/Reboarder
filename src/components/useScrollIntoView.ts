import { useEffect, type RefObject } from 'react';

export function useScrollIntoView(
	containerRef: RefObject<HTMLElement | null>,
	childSelector: string,
	selectedIndex: number,
) {
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const children = container.querySelectorAll(childSelector);
		const child = children[selectedIndex];
		if (child) {
			child.scrollIntoView({ block: 'nearest', behavior: 'instant' });
		}
	}, [selectedIndex, containerRef, childSelector]);
}
