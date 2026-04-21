import { useEffect, useRef, useState } from 'react';

export function useRevealAnimation(threshold = 0.05) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		// Keep this effect retrying until the target node exists, because some
		// sections (e.g. store) render a loading skeleton first.
		if (isVisible) return;
		const node = ref.current;
		if (!node) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ threshold }
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, [threshold, isVisible]);

	return { ref, isVisible };
}
