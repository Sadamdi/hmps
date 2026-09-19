import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export type BugFilterSort = 'newest' | 'oldest';

export interface BugFilterBarState {
	dateFrom: string;
	dateTo: string;
	query: string;
	sort: BugFilterSort;
}

interface BugFilterBarProps {
	value: BugFilterBarState;
	onApply: (next: BugFilterBarState) => void;
	onReset: () => void;
	loading?: boolean;
	queryPlaceholder?: string;
}

/**
 * Bar filter rich di atas daftar bug / bug otomatis:
 *  - Row 1: search input + sort dropdown (sort applied langsung, sisanya via tombol)
 *  - Row 2: date dari–sampai + tombol Terapkan + tombol Reset
 */
export function BugFilterBar({
	value,
	onApply,
	onReset,
	loading,
	queryPlaceholder = 'Cari deskripsi / nama / email / username…',
}: BugFilterBarProps) {
	const [dateFrom, setDateFrom] = useState(value.dateFrom);
	const [dateTo, setDateTo] = useState(value.dateTo);
	const [query, setQuery] = useState(value.query);

	// Sinkronkan state lokal jika parent berubah (mis. setelah reset atau pagination).
	useEffect(() => {
		setDateFrom(value.dateFrom);
		setDateTo(value.dateTo);
		setQuery(value.query);
	}, [value.dateFrom, value.dateTo, value.query]);

	const handleApply = () => {
		onApply({ dateFrom, dateTo, query, sort: value.sort });
	};

	const handleReset = () => {
		setDateFrom('');
		setDateTo('');
		setQuery('');
		onReset();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleApply();
		}
	};

	return (
		<div className="rounded-lg border bg-card/40 p-3 space-y-3">
			<div className="flex flex-col sm:flex-row gap-2">
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
					<Input
						className="pl-9"
						placeholder={queryPlaceholder}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={loading}
					/>
				</div>
				<div className="w-full sm:w-[180px]">
					<Select
						value={value.sort}
						onValueChange={(v) => {
							if (v === '__all_sort__') return;
							onApply({ ...value, sort: v as BugFilterSort });
						}}
						disabled={loading}
					>
						<SelectTrigger>
							<SelectValue placeholder="Urutkan" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="newest">Terbaru dulu</SelectItem>
							<SelectItem value="oldest">Terlama dulu</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row sm:items-end gap-2">
				<div className="flex-1 min-w-[140px]">
					<Label htmlFor="bug-filter-date-from" className="text-xs">
						Dari tanggal
					</Label>
					<Input
						id="bug-filter-date-from"
						type="date"
						value={dateFrom}
						onChange={(e) => setDateFrom(e.target.value)}
						disabled={loading}
						className="h-10"
					/>
				</div>
				<div className="flex-1 min-w-[140px]">
					<Label htmlFor="bug-filter-date-to" className="text-xs">
						Sampai tanggal
					</Label>
					<Input
						id="bug-filter-date-to"
						type="date"
						value={dateTo}
						onChange={(e) => setDateTo(e.target.value)}
						disabled={loading}
						className="h-10"
					/>
				</div>
				<div className="flex gap-2">
					<Button
						type="button"
						size="sm"
						onClick={handleApply}
						disabled={loading}
					>
						<Filter className="h-4 w-4 mr-1" />
						Terapkan
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={handleReset}
						disabled={loading}
					>
						<RotateCcw className="h-4 w-4 mr-1" />
						Reset
					</Button>
				</div>
			</div>
		</div>
	);
}