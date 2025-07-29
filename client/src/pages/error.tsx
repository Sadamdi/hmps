import { ErrorPage } from '@/components/ui/error-page';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export default function Error() {
	const [location] = useLocation();
	const [error, setError] = useState<any>(null);

	useEffect(() => {
		// Coba ambil error dari URL parameters atau localStorage
		const urlParams = new URLSearchParams(window.location.search);
		const errorParam = urlParams.get('error');

		if (errorParam) {
			try {
				const parsedError = JSON.parse(decodeURIComponent(errorParam));
				setError(parsedError);
			} catch (e) {
				// Fallback error jika parsing gagal
				setError({
					code: 500,
					title: 'Internal Server Error',
					message: 'Terjadi kesalahan yang tidak diketahui',
					timestamp: new Date().toISOString(),
					help: 'Silakan coba lagi nanti atau hubungi administrator',
				});
			}
		} else {
			// Default error jika tidak ada parameter
			setError({
				code: 404,
				title: 'Page Not Found',
				message: 'Halaman yang Anda cari tidak ditemukan',
				timestamp: new Date().toISOString(),
				help: 'Periksa URL yang Anda masukkan atau kembali ke halaman utama',
			});
		}
	}, [location]);

	const handleRetry = () => {
		window.location.reload();
	};

	if (!error) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		);
	}

	return (
		<ErrorPage
			error={error}
			onRetry={handleRetry}
		/>
	);
}
