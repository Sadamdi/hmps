import React from 'react';

interface GDriveFallbackProps {
	className?: string;
	alt?: string;
	type?: 'banner' | 'person' | 'generic';
	message?: string;
}

// Komponen fallback untuk ketika Google Drive tidak tersedia
export function GDriveFallback({ 
	className = '', 
	alt = 'Asset', 
	type = 'generic',
	message 
}: GDriveFallbackProps) {
	
	const getFallbackContent = () => {
		switch (type) {
			case 'banner':
				return (
					<div className={`bg-gradient-to-r from-blue-500 to-purple-600 ${className}`}>
						<div className="flex items-center justify-center h-full">
							<div className="text-center text-white">
								<div className="text-4xl mb-2">🏢</div>
								<div className="text-lg font-semibold">HMPS</div>
								<div className="text-sm opacity-80">Himpunan Mahasiswa Program Studi</div>
							</div>
						</div>
					</div>
				);
			
			case 'person':
				return (
					<div className={`bg-gradient-to-br from-gray-100 to-gray-200 ${className}`}>
						<div className="flex items-center justify-center h-full">
							<div className="text-center text-gray-600">
								<div className="text-6xl mb-4">👥</div>
								<div className="text-lg font-semibold">Tim HMPS</div>
								<div className="text-sm opacity-70">Mahasiswa Berprestasi</div>
							</div>
						</div>
					</div>
				);
			
			default:
				return (
					<div className={`bg-gray-100 ${className}`}>
						<div className="flex items-center justify-center h-full">
							<div className="text-center text-gray-500">
								<div className="text-4xl mb-2">📁</div>
								<div className="text-sm">
									{message || 'Asset tidak tersedia'}
								</div>
							</div>
						</div>
					</div>
				);
		}
	};

	return (
		<div 
			className={`flex items-center justify-center ${className}`}
			role="img"
			aria-label={alt}
		>
			{getFallbackContent()}
		</div>
	);
}

// Komponen loading untuk asset Google Drive
export function GDriveLoading({ 
	className = '', 
	type = 'generic' 
}: {
	className?: string;
	type?: 'banner' | 'person' | 'generic';
}) {
	
	const getLoadingContent = () => {
		switch (type) {
			case 'banner':
				return (
					<div className={`bg-gradient-to-r from-blue-200 to-purple-200 animate-pulse ${className}`}>
						<div className="flex items-center justify-center h-full">
							<div className="text-center text-blue-600">
								<div className="text-2xl mb-2">⏳</div>
								<div className="text-sm">Memuat Banner...</div>
							</div>
						</div>
					</div>
				);
			
			case 'person':
				return (
					<div className={`bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse ${className}`}>
						<div className="flex items-center justify-center h-full">
							<div className="text-center text-gray-600">
								<div className="text-2xl mb-2">⏳</div>
								<div className="text-sm">Memuat Gambar...</div>
							</div>
						</div>
					</div>
				);
			
			default:
				return (
					<div className={`bg-gray-200 animate-pulse ${className}`}>
						<div className="flex items-center justify-center h-full">
							<div className="text-center text-gray-500">
								<div className="text-xl mb-1">⏳</div>
								<div className="text-xs">Loading...</div>
							</div>
						</div>
					</div>
				);
		}
	};

	return getLoadingContent();
}

// Komponen error untuk asset Google Drive
export function GDriveError({ 
	className = '', 
	alt = 'Error',
	onRetry 
}: {
	className?: string;
	alt?: string;
	onRetry?: () => void;
}) {
	return (
		<div className={`bg-red-50 border border-red-200 ${className}`}>
			<div className="flex items-center justify-center h-full">
				<div className="text-center text-red-600">
					<div className="text-4xl mb-2">⚠️</div>
					<div className="text-sm mb-2">Gagal memuat asset</div>
					{onRetry && (
						<button
							onClick={onRetry}
							className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
						>
							Coba Lagi
						</button>
					)}
				</div>
			</div>
		</div>
	);
} 