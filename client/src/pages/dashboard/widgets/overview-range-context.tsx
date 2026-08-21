import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type RangeKey = '1d' | '3d' | '7d' | '30d';

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
	{ key: '1d', label: '1 Hari', days: 1 },
	{ key: '3d', label: '3 Hari', days: 3 },
	{ key: '7d', label: '7 Hari', days: 7 },
	{ key: '30d', label: '30 Hari', days: 30 },
];

interface OverviewRangeContextValue {
	range: RangeKey;
	days: number;
	setRange: (r: RangeKey) => void;
}

const OverviewRangeContext = createContext<OverviewRangeContextValue>({
	range: '7d',
	days: 7,
	setRange: () => {},
});

export function useOverviewRange(): OverviewRangeContextValue {
	return useContext(OverviewRangeContext);
}

interface OverviewRangeProviderProps {
	children: React.ReactNode;
	defaultRange?: RangeKey;
}

export function OverviewRangeProvider({
	children,
	defaultRange = '7d',
}: OverviewRangeProviderProps) {
	const [range, setRangeState] = useState<RangeKey>(defaultRange);

	const setRange = useCallback((r: RangeKey) => {
		setRangeState(r);
	}, []);

	const value = useMemo<OverviewRangeContextValue>(() => {
		const opt = RANGE_OPTIONS.find((o) => o.key === range);
		return {
			range,
			days: opt?.days ?? 7,
			setRange,
		};
	}, [range, setRange]);

	return (
		<OverviewRangeContext.Provider value={value}>
			{children}
		</OverviewRangeContext.Provider>
	);
}
