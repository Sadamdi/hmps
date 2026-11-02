import type {
	ArchiveActiveChip,
	ArchiveDateRangeControl,
	ArchiveFilterGroup,
	ArchiveSortControl,
} from '@/components/public/archive/archive-filter-bar';
import { searchTokens, smartSearchScore } from '@shared/smart-search';
import { createElement, useCallback, useMemo, useState } from 'react';
import { Calendar, Tag } from 'lucide-react';

export type ArchiveSortKey = 'default' | 'newest' | 'oldest' | 'az' | 'za' | 'updated';

const SORT_LABELS: Record<ArchiveSortKey, string> = {
	default: 'Bawaan',
	newest: 'Terbaru',
	oldest: 'Terlama',
	az: 'Judul A–Z',
	za: 'Judul Z–A',
	updated: 'Terakhir diperbarui',
};

type DateLike = string | Date | null | undefined;

type UseArchiveFiltersOptions<T> = {
	items: T[];
	/** Isi pencarian (judul + deskripsi). Dipakai bersama `getTitle` untuk pencarian berbobot. */
	getSearchText: (item: T) => string;
	/** Judul untuk pencarian berbobot dan urut A–Z. */
	getTitle?: (item: T) => string;
	/** Tanggal utama (dibuat/kegiatan) untuk urut waktu dan rentang tanggal. */
	getDate?: (item: T) => DateLike;
	/** Tanggal diperbarui terakhir untuk urutan "Terakhir diperbarui". */
	getUpdatedAt?: (item: T) => DateLike;
	getYear?: (item: T) => number | null;
	getTags?: (item: T) => string[] | undefined;
	initialTags?: string[];
};

function toTime(v: DateLike): number {
	if (!v) return 0;
	const t = new Date(v).getTime();
	return Number.isFinite(t) ? t : 0;
}

/** "2026-11-03" → awal hari lokal. */
function dayStart(value: string): number | null {
	if (!value) return null;
	const t = new Date(`${value}T00:00:00`).getTime();
	return Number.isFinite(t) ? t : null;
}

function dayEnd(value: string): number | null {
	if (!value) return null;
	const t = new Date(`${value}T23:59:59.999`).getTime();
	return Number.isFinite(t) ? t : null;
}

function formatDay(value: string): string {
	const t = dayStart(value);
	return t === null
		? value
		: new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * State search / filter / urutan untuk halaman list + derivasi opsi filter.
 * - search: pintar (abaikan tanda baca, toleran salah ketik); saat urutan "Bawaan" diurut relevansi
 * - tag (OR), tahun (tunggal), rentang tanggal (dari–sampai) dan urutan semuanya bisa digabung.
 */
export function useArchiveFilters<T>({
	items,
	getSearchText,
	getTitle,
	getDate,
	getUpdatedAt,
	getYear,
	getTags,
	initialTags = [],
}: UseArchiveFiltersOptions<T>) {
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const [sortKey, setSortKey] = useState<ArchiveSortKey>('default');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');

	const allYears = useMemo(() => {
		if (!getYear) return [];
		const s = new Set<number>();
		items.forEach((i) => {
			const y = getYear(i);
			if (y && y > 2000) s.add(y);
		});
		return Array.from(s).sort((a, b) => b - a);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [items]);

	const allTags = useMemo(() => {
		if (!getTags) return [];
		const s = new Set<string>();
		items.forEach((i) => getTags(i)?.forEach((t) => s.add(t)));
		return Array.from(s).sort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [items]);

	const filtered = useMemo(() => {
		let out = items;
		let scores: Map<T, number> | null = null;

		if (searchTokens(searchTerm).length > 0) {
			const scoreMap = new Map<T, number>();
			const hits: T[] = [];
			for (const i of out) {
				const s = getTitle
					? smartSearchScore(searchTerm, getTitle(i), getSearchText(i))
					: smartSearchScore(searchTerm, getSearchText(i));
				if (s > 0) {
					scoreMap.set(i, s);
					hits.push(i);
				}
			}
			scores = scoreMap;
			out = hits;
		}
		if (getTags && selectedTags.length > 0) {
			out = out.filter((i) => {
				const tags = getTags(i);
				return !!tags && selectedTags.some((t) => tags.includes(t));
			});
		}
		if (getYear && selectedYear !== null) {
			out = out.filter((i) => getYear(i) === selectedYear);
		}
		if (getDate && (dateFrom || dateTo)) {
			const from = dayStart(dateFrom);
			const to = dayEnd(dateTo);
			out = out.filter((i) => {
				const t = toTime(getDate(i));
				if (!t) return false;
				return (from === null || t >= from) && (to === null || t <= to);
			});
		}

		const originalIndex = new Map<T, number>();
		items.forEach((i, idx) => originalIndex.set(i, idx));
		const stable = (a: T, b: T) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
		const sorted = [...out];
		switch (sortKey) {
			case 'newest':
				if (getDate) sorted.sort((a, b) => toTime(getDate(b)) - toTime(getDate(a)) || stable(a, b));
				break;
			case 'oldest':
				if (getDate) sorted.sort((a, b) => toTime(getDate(a)) - toTime(getDate(b)) || stable(a, b));
				break;
			case 'updated': {
				const get = getUpdatedAt ?? getDate;
				if (get) sorted.sort((a, b) => toTime(get(b)) - toTime(get(a)) || stable(a, b));
				break;
			}
			case 'az':
			case 'za': {
				const title = getTitle ?? getSearchText;
				const dir = sortKey === 'az' ? 1 : -1;
				sorted.sort(
					(a, b) =>
						dir * title(a).localeCompare(title(b), 'id', { sensitivity: 'base', numeric: true }) ||
						stable(a, b),
				);
				break;
			}
			default:
				// Bawaan: urutan asli; saat mencari, urut berdasarkan relevansi.
				if (scores) {
					const sc = scores;
					sorted.sort((a, b) => (sc.get(b) ?? 0) - (sc.get(a) ?? 0) || stable(a, b));
				}
		}
		return sorted;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [items, searchTerm, selectedTags, selectedYear, sortKey, dateFrom, dateTo]);

	const toggleTag = useCallback((tag: string) => {
		setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
	}, []);

	const clearFilters = useCallback(() => {
		setSearchTerm('');
		setSelectedTags([]);
		setSelectedYear(null);
		setSortKey('default');
		setDateFrom('');
		setDateTo('');
	}, []);

	const groups: ArchiveFilterGroup[] = [
		...(allYears.length > 1
			? [
					{
						key: 'year',
						label: 'Tahun',
						icon: createElement(Calendar),
						options: allYears.map((y) => ({ value: String(y), label: String(y) })),
						isSelected: (v: string) => selectedYear === Number(v),
						onSelect: (v: string) => setSelectedYear((cur) => (cur === Number(v) ? null : Number(v))),
					},
				]
			: []),
		...(allTags.length > 0
			? [
					{
						key: 'tag',
						label: 'Tag',
						icon: createElement(Tag),
						options: allTags.map((t) => ({ value: t, label: t })),
						isSelected: (v: string) => selectedTags.includes(v),
						onSelect: toggleTag,
					},
				]
			: []),
	];

	const sortKeys: ArchiveSortKey[] = [
		'default',
		...(getDate ? (['newest', 'oldest'] as ArchiveSortKey[]) : []),
		'az',
		'za',
		...(getUpdatedAt ? (['updated'] as ArchiveSortKey[]) : []),
	];
	const sort: ArchiveSortControl = {
		value: sortKey,
		options: sortKeys.map((k) => ({
			value: k,
			label: k === 'default' && searchTerm ? 'Paling relevan' : SORT_LABELS[k],
		})),
		onChange: (v) => setSortKey(v as ArchiveSortKey),
	};
	const dateRange: ArchiveDateRangeControl | undefined = getDate
		? {
				from: dateFrom,
				to: dateTo,
				onChange: (from, to) => {
					setDateFrom(from);
					setDateTo(to);
				},
			}
		: undefined;

	const dateChip: ArchiveActiveChip[] =
		dateFrom || dateTo
			? [
					{
						key: 'date-range',
						label: `${dateFrom ? formatDay(dateFrom) : '…'} – ${dateTo ? formatDay(dateTo) : '…'}`,
						onRemove: () => {
							setDateFrom('');
							setDateTo('');
						},
					},
				]
			: [];

	const activeChips: ArchiveActiveChip[] = [
		...(selectedYear !== null
			? [{ key: `year-${selectedYear}`, label: String(selectedYear), onRemove: () => setSelectedYear(null) }]
			: []),
		...dateChip,
		...(sortKey !== 'default'
			? [{ key: 'sort', label: `Urut: ${SORT_LABELS[sortKey]}`, onRemove: () => setSortKey('default') }]
			: []),
		...selectedTags.map((t) => ({ key: `tag-${t}`, label: t, onRemove: () => toggleTag(t) })),
	];

	return {
		searchTerm,
		setSearchTerm,
		selectedTags,
		setSelectedTags,
		selectedYear,
		setSelectedYear,
		sortKey,
		dateFrom,
		dateTo,
		toggleTag,
		clearFilters,
		allYears,
		allTags,
		filtered,
		groups,
		sort,
		dateRange,
		activeChips,
		hasActiveFilters:
			selectedTags.length > 0 || selectedYear !== null || sortKey !== 'default' || !!dateFrom || !!dateTo,
	};
}
