import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from '@/components/ui/error-page';
import { reportClientError } from '@/lib/error-monitor';

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
}

/**
 * Menangkap crash render React ("bug tampilan") agar aplikasi tidak blank putih,
 * sekaligus melaporkannya ke bug monitoring otomatis.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): ErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		reportClientError({
			name: error?.name || 'Error',
			message: error?.message,
			stack: error?.stack,
			componentStack: info?.componentStack || '',
			source: 'react',
		});
	}

	private handleRetry = (): void => {
		this.setState({ hasError: false });
		window.location.reload();
	};

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<ErrorPage
					error={{
						code: 500,
						title: 'Terjadi Kesalahan',
						message:
							'Maaf, terjadi kesalahan saat menampilkan halaman. Tim kami telah menerima laporannya secara otomatis.',
						timestamp: new Date().toISOString(),
						help: 'Silakan muat ulang halaman atau coba lagi nanti.',
					}}
					onRetry={this.handleRetry}
				/>
			);
		}
		return this.props.children;
	}
}
