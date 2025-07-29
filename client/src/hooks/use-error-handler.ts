import { useLocation } from 'wouter';
import { useToast } from './use-toast';

interface ErrorDetails {
	code: number;
	title: string;
	message: string;
	timestamp: string;
	details?: {
		reason?: string;
		path?: string;
		method?: string;
		ip?: string;
		deviceId?: string;
		retryAfter?: number;
		limit?: number;
		window?: string;
		maxConnections?: number;
		maxAttempts?: number;
		maxUploads?: number;
	};
	help?: string;
}

export function useErrorHandler() {
	const [, navigate] = useLocation();
	const { toast } = useToast();

	const handleError = (error: any, showToast: boolean = true) => {
		console.error('Error handled:', error);

		// Jika error sudah dalam format yang benar
		if (error?.error) {
			const errorData: ErrorDetails = error.error;

			// Redirect ke error page
			const errorParam = encodeURIComponent(JSON.stringify(errorData));
			navigate(`/error?error=${errorParam}`);
			return;
		}

		// Jika error dari fetch response
		if (error?.status) {
			const errorData: ErrorDetails = {
				code: error.status,
				title: error.statusText || 'Error',
				message: error.message || 'An error occurred',
				timestamp: new Date().toISOString(),
				details: error.details,
				help: error.help,
			};

			const errorParam = encodeURIComponent(JSON.stringify(errorData));
			navigate(`/error?error=${errorParam}`);
			return;
		}

		// Fallback untuk error biasa
		if (showToast) {
			toast({
				title: 'Error',
				description: error?.message || 'Terjadi kesalahan yang tidak diketahui',
				variant: 'destructive',
			});
		}
	};

	const handleApiError = async (response: Response) => {
		if (!response.ok) {
			let errorData;
			try {
				errorData = await response.json();
			} catch (e) {
				errorData = {
					message: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			// Jika error dari DDoS protection atau rate limit
			if (errorData?.error) {
				handleError(errorData, false);
				return;
			}

			// Untuk API errors, show toast
			toast({
				title: 'Error',
				description: errorData?.message || `HTTP ${response.status}`,
				variant: 'destructive',
			});
		}
	};

	return {
		handleError,
		handleApiError,
	};
}
