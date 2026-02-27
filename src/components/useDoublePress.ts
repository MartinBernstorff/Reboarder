import { useRef, useCallback } from 'react';

export function useDoublePress(onDoublePress: () => void, timeout = 1000): () => void {
	const lastPressRef = useRef<number>(0);

	return useCallback(() => {
		const now = Date.now();
		if (now - lastPressRef.current < timeout) {
			lastPressRef.current = 0;
			onDoublePress();
		} else {
			lastPressRef.current = now;
		}
	}, [onDoublePress, timeout]);
}
