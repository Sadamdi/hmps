import type { ArchiveActiveChip, ArchiveFilterGroup } from '@/components/public/archive/archive-filter-bar';
import { createElement, useCallback, useMemo, useState } from 'react';
import { Calendar, Tag } from 'lucide-react';

type UseArchiveFiltersOptions<T> = {
	items: T[];
	getSearchText: (item: T) => string;
	getYear?: (item: T) => number | null;
	getTags?: (item: T) => string[] | undefined;
	initialTags?: string[];
};

/**
 * State search / tahun / tag untuk halaman list + derivasi opsi filter.
 * Semantik sama dengan filter lama berita & galeri:
 * search = judul/deskripsi (case-insensitive), tag = OR, tahun = single.
 */
export function useArchiveFilters<T>({
	items,
	getSearchText,
	getYear,
	getTags,
	initialTags = [],
}: UseArchiveFiltersOptions<T>) {
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
	const [selectedYear, setSelectedYear] = useState<number | null>(null);

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
		if (searchTerm) {
			const q = searchTerm.toLowerCase();
			out = out.filter((i) => getSearchText(i).toLowerCase().includes(q));
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
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [items, searchTerm, selectedTags, selectedYear]);

	const toggleTag = useCallback((tag: string) => {
		setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
	}, []);

	const clearFilters = useCallback(() => {
		setSearchTerm('');
		setSelectedTags([]);
		setSelectedYear(null);
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

	const activeChips: ArchiveActiveChip[] = [
		...(selectedYear !== null
			? [{ key: `year-${selectedYear}`, label: String(selectedYear), onRemove: () => setSelectedYear(null) }]
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
		toggleTag,
		clearFilters,
		allYears,
		allTags,
		filtered,
		groups,
		activeChips,
		hasActiveFilters: selectedTags.length > 0 || selectedYear !== null,
	};
}
