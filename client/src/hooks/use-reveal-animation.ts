import { useEffect, useRef, useState } from 'react';

export function useRevealAnimation(threshold = 0.05) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
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
	}, [threshold]);

	return { ref, isVisible };
}
