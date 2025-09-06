import { useEffect, useMemo, useState } from 'react';

interface UsePaginationProps {
	data: any[];
	itemsPerPageDesktop?: number;
	itemsPerPageMobile?: number;
}

interface UsePaginationReturn {
	currentPage: number;
	totalPages: number;
	paginatedData: any[];
	setCurrentPage: (page: number) => void;
	itemsPerPage: number;
}

export function usePagination({
	data,
	itemsPerPageDesktop = 8,
	itemsPerPageMobile = 4,
}: UsePaginationProps): UsePaginationReturn {
	const [currentPage, setCurrentPage] = useState(1);
	const [isMobile, setIsMobile] = useState(false);

	// Check if screen is mobile
	useEffect(() => {
		const checkIsMobile = () => {
			setIsMobile(window.innerWidth < 768); // md breakpoint
		};

		checkIsMobile();
		window.addEventListener('resize', checkIsMobile);

		return () => window.removeEventListener('resize', checkIsMobile);
	}, []);

	const itemsPerPage = isMobile ? itemsPerPageMobile : itemsPerPageDesktop;

	const totalPages = useMemo(() => {
		return Math.ceil(data.length / itemsPerPage);
	}, [data.length, itemsPerPage]);

	const paginatedData = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return data.slice(startIndex, endIndex);
	}, [data, currentPage, itemsPerPage]);

	// Reset to page 1 when data changes or itemsPerPage changes
	useEffect(() => {
		setCurrentPage(1);
	}, [data.length, itemsPerPage]);

	return {
		currentPage,
		totalPages,
		paginatedData,
		setCurrentPage,
		itemsPerPage,
	};
}
