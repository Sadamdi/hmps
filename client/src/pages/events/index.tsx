import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function EventsIndex() {
	const [, setLocation] = useLocation();

	const { data } = useQuery<{ year: { year: number } | null }>({
		queryKey: ['/api/events/active-home'],
		staleTime: 60 * 1000,
	});

	useEffect(() => {
		if (!data) return;
		if (data.year) {
			setLocation(`/events/${data.year.year}`);
		} else {
			setLocation('/');
		}
	}, [data, setLocation]);

	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
		</div>
	);
}
