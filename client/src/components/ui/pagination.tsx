import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	className?: string;
}

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
	className = '',
}: PaginationProps) {
	const [isAnimating, setIsAnimating] = useState(false);

	if (totalPages <= 1) return null;

	const handlePageChange = (page: number) => {
		if (page === currentPage || isAnimating) return;

		setIsAnimating(true);
		onPageChange(page);

		// Reset animation state after transition
		setTimeout(() => {
			setIsAnimating(false);
		}, 300);
	};

	const getVisiblePages = () => {
		const delta = 2; // Number of pages to show on each side of current page
		const range = [];
		const rangeWithDots = [];

		for (
			let i = Math.max(2, currentPage - delta);
			i <= Math.min(totalPages - 1, currentPage + delta);
			i++
		) {
			range.push(i);
		}

		if (currentPage - delta > 2) {
			rangeWithDots.push(1, '...');
		} else {
			rangeWithDots.push(1);
		}

		rangeWithDots.push(...range);

		if (currentPage + delta < totalPages - 1) {
			rangeWithDots.push('...', totalPages);
		} else {
			rangeWithDots.push(totalPages);
		}

		return rangeWithDots;
	};

	const visiblePages = getVisiblePages();

	return (
		<div className={`flex items-center justify-center space-x-2 ${className}`}>
			<Button
				variant="outline"
				size="sm"
				onClick={() => handlePageChange(currentPage - 1)}
				disabled={currentPage === 1 || isAnimating}
				className={`pagination-button flex items-center ${
					isAnimating ? 'opacity-50' : ''
				}`}>
				<ChevronLeft className="h-4 w-4 mr-1" />
				Previous
			</Button>

			<div className="flex items-center space-x-1">
				{visiblePages.map((page, index) => {
					if (page === '...') {
						return (
							<span
								key={`dots-${index}`}
								className="px-3 py-2 text-sm text-gray-500">
								...
							</span>
						);
					}

					const pageNumber = page as number;
					const isActive = currentPage === pageNumber;
					return (
						<Button
							key={pageNumber}
							variant={isActive ? 'default' : 'outline'}
							size="sm"
							onClick={() => handlePageChange(pageNumber)}
							disabled={isAnimating}
							className={`pagination-button min-w-[40px] ${
								isActive
									? 'bg-primary text-primary-foreground shadow-lg'
									: 'hover:bg-primary/10'
							} ${isAnimating ? 'opacity-50' : ''}`}>
							{pageNumber}
						</Button>
					);
				})}
			</div>

			<Button
				variant="outline"
				size="sm"
				onClick={() => handlePageChange(currentPage + 1)}
				disabled={currentPage === totalPages || isAnimating}
				className={`pagination-button flex items-center ${
					isAnimating ? 'opacity-50' : ''
				}`}>
				Next
				<ChevronRight className="h-4 w-4 ml-1" />
			</Button>
		</div>
	);
}
