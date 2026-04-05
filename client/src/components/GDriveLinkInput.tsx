import { validateGoogleDriveUrl } from '@shared/mediaUtils';
import { useCallback, useEffect, useRef, useState } from 'react';

interface GDriveLinkInputProps {
	value: string;
	onChange: (url: string) => void;
	onValidation: (isValid: boolean, error?: string) => void;
	placeholder?: string;
	className?: string;
	label?: string;
	mediaType?: 'image' | 'video' | 'auto';
	onMediaTypeChange?: (type: 'image' | 'video') => void;
	/** Sembunyikan pemilih foto/video manual (auto saja) */
	hideMediaTypeSelector?: boolean;
	/** Dipanggil saat check-access mendeteksi folder */
	onFolderDetected?: (isFolder: boolean) => void;
}

interface ValidationState {
	isValidating: boolean;
	isValid: boolean;
	error?: string;
	suggestion?: string;
	isFolder?: boolean;
}

export function GDriveLinkInput({
	value,
	onChange,
	onValidation,
	placeholder = 'Paste Google Drive link here...',
	className = '',
	label = 'Google Drive Link',
	mediaType = 'auto',
	onMediaTypeChange,
	hideMediaTypeSelector = false,
	onFolderDetected,
}: GDriveLinkInputProps) {
	const [validation, setValidation] = useState<ValidationState>({
		isValidating: false,
		isValid: false,
	});

	const onValidationRef = useRef(onValidation);
	onValidationRef.current = onValidation;
	const onFolderDetectedRef = useRef(onFolderDetected);
	onFolderDetectedRef.current = onFolderDetected;

	const lastCheckRef = useRef<{ url: string; at: number } | null>(null);

	const runServerCheck = useCallback(async (url: string) => {
		const trimmed = url.trim();
		if (!trimmed) {
			setValidation({ isValidating: false, isValid: false });
			onValidationRef.current(false);
			return;
		}

		const now = Date.now();
		const last = lastCheckRef.current;
		if (last && last.url === trimmed && now - last.at < 2500) {
			return;
		}

		const result = validateGoogleDriveUrl(trimmed);
		if (!result.isValid) {
			setValidation({
				isValidating: false,
				isValid: false,
				error: result.error,
				suggestion: result.suggestion,
			});
			onValidationRef.current(false, result.error);
			return;
		}

		setValidation((prev) => ({ ...prev, isValidating: true }));
		lastCheckRef.current = { url: trimmed, at: now };

		try {
			const response = await fetch('/api/gdrive/check-access', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: trimmed }),
			});

			const data = await response.json();

			if (data.accessible) {
				setValidation({
					isValidating: false,
					isValid: true,
					isFolder: data.isFolder,
				});
				onValidationRef.current(true);
				onFolderDetectedRef.current?.(!!data.isFolder);
			} else {
				let errorMessage =
					'File is private and cannot be accessed by the server';
				let suggestionMessage =
					'Make sure the file/folder is shared publicly with "Anyone with the link" permission';

				if (data.isFolder) {
					errorMessage =
						'Folder content listing is not available with current setup';
					suggestionMessage =
						'Please copy individual file share links instead of the folder link';
				}

				setValidation({
					isValidating: false,
					isValid: false,
					error: errorMessage,
					suggestion: suggestionMessage,
					isFolder: data.isFolder,
				});
				onValidationRef.current(false, errorMessage);
			}
		} catch {
			setValidation({
				isValidating: false,
				isValid: false,
				error: 'Unable to verify file accessibility',
				suggestion: 'Please check your internet connection and try again',
			});
			onValidationRef.current(false, 'Unable to verify file accessibility');
		}
	}, []);

	const prevValueRef = useRef<string | undefined>(undefined);

	/**
	 * Kosongkan status bila URL dikosongkan; satu kali check saat kosong → URL valid
	 * (paste / load edit), tanpa memicu ulang setiap render parent.
	 */
	useEffect(() => {
		const prev = prevValueRef.current;
		const trimmed = value?.trim() ?? '';
		const prevTrim = prev?.trim() ?? '';

		if (!trimmed) {
			setValidation({ isValidating: false, isValid: false });
			onValidationRef.current(false);
			prevValueRef.current = value;
			return;
		}

		prevValueRef.current = value;

		const becameFilled = !prevTrim && !!trimmed;
		if (becameFilled && validateGoogleDriveUrl(trimmed).isValid) {
			void runServerCheck(trimmed);
		}
	}, [value, runServerCheck]);

	const handleBlur = () => {
		const trimmed = value.trim();
		if (!trimmed) {
			setValidation({ isValidating: false, isValid: false });
			onValidationRef.current(false);
			return;
		}
		void runServerCheck(trimmed);
	};

	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium text-gray-700">{label}</label>

			<div className="relative flex gap-2">
				<input
					type="url"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={placeholder}
					className={getInputClassName(
						className,
						value,
						validation.isValidating,
						validation.isValid,
					)}
				/>

				<button
					type="button"
					onClick={() => void runServerCheck(value)}
					disabled={!value.trim() || validation.isValidating}
					className="shrink-0 px-3 py-2 text-sm border rounded-md border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
					Periksa akses
				</button>

				{validation.isValidating && (
					<div className="absolute right-[5.5rem] top-1/2 transform -translate-y-1/2 pointer-events-none">
						<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
					</div>
				)}

				{!validation.isValidating && value && validation.isValid && (
					<div className="absolute right-[5.5rem] top-1/2 transform -translate-y-1/2 pointer-events-none">
						<svg
							className="h-4 w-4 text-green-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
				)}

				{!validation.isValidating && value && !validation.isValid && (
					<div className="absolute right-[5.5rem] top-1/2 transform -translate-y-1/2 pointer-events-none">
						<svg
							className="h-4 w-4 text-red-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</div>
				)}
			</div>

			{/* Media Type Selector for valid single files */}
			{validation.isValid && !validation.isFolder && onMediaTypeChange && !hideMediaTypeSelector && (
				<div className="mt-3 p-3 bg-blue-50 rounded-md">
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Media Type (if auto-detection fails):
					</label>
					<div className="flex space-x-4">
						<label className="flex items-center">
							<input
								type="radio"
								name="mediaType"
								value="image"
								checked={mediaType === 'image'}
								onChange={() => onMediaTypeChange('image')}
								className="mr-2"
							/>
							📸 Image/Photo
						</label>
						<label className="flex items-center">
							<input
								type="radio"
								name="mediaType"
								value="video"
								checked={mediaType === 'video'}
								onChange={() => onMediaTypeChange('video')}
								className="mr-2"
							/>
							🎥 Video
						</label>
					</div>
					<p className="text-xs text-gray-600 mt-1">
						Select the correct type if the preview shows wrong media type
					</p>
				</div>
			)}

			{/* Validation feedback */}
			{validation.error && (
				<div className="text-sm text-red-600">
					<p>{validation.error}</p>
					{validation.suggestion && (
						<p className="text-gray-500 mt-1">{validation.suggestion}</p>
					)}
				</div>
			)}

			{validation.isValid && !validation.isFolder && (
				<div className="text-sm text-green-600">
					✓ Google Drive file is accessible and ready to use
				</div>
			)}

			{validation.isValid && validation.isFolder && (
				<div className="text-sm text-green-600">
					✓ Folder terdeteksi dan bisa diakses — akan ditampilkan sebagai embed.
				</div>
			)}

			{/* Format hints */}
			{!value && (
				<div className="text-xs text-gray-500">
					<p>Supported formats:</p>
					<ul className="list-disc list-inside mt-1 space-y-1">
						<li>
							https://drive.google.com/file/d/FILE_ID/view (single file -
							recommended)
						</li>
						<li>
							https://drive.google.com/folders/FOLDER_ID (folder - limited
							support)
						</li>
					</ul>
				</div>
			)}
		</div>
	);
}

function getInputClassName(
	className: string,
	value: string,
	isValidating: boolean,
	isValid: boolean,
) {
	let base = `w-full min-w-0 flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${className}`;

	if (isValidating) {
		return `${base} border-yellow-300 focus:ring-yellow-500`;
	}

	if (value && !isValidating) {
		if (isValid) {
			return `${base} border-green-300 focus:ring-green-500`;
		}
		return `${base} border-red-300 focus:ring-red-500`;
	}

	return `${base} border-gray-300 focus:ring-blue-500`;
}
