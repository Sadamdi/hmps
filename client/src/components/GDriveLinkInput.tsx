import { validateGoogleDriveUrl } from '@shared/mediaUtils';
import { useEffect, useState } from 'react';

interface GDriveLinkInputProps {
	value: string;
	onChange: (url: string) => void;
	onValidation: (isValid: boolean, error?: string) => void;
	placeholder?: string;
	className?: string;
	label?: string;
	mediaType?: 'image' | 'video' | 'auto';
	onMediaTypeChange?: (type: 'image' | 'video') => void;
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
}: GDriveLinkInputProps) {
	const [validation, setValidation] = useState<ValidationState>({
		isValidating: false,
		isValid: false,
	});

	// Validate URL when value changes
	useEffect(() => {
		if (!value || value.trim() === '') {
			setValidation({ isValidating: false, isValid: false });
			onValidation(false);
			return;
		}

		setValidation((prev) => ({ ...prev, isValidating: true }));

		// Debounce validation
		const timeoutId = setTimeout(async () => {
			const result = validateGoogleDriveUrl(value);

			if (result.isValid) {
				// Check accessibility with server
				try {
					const response = await fetch('/api/gdrive/check-access', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: value }),
					});

					const data = await response.json();

					if (data.accessible) {
						setValidation({
							isValidating: false,
							isValid: true,
							isFolder: data.isFolder,
						});
						onValidation(true);
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
						onValidation(false, errorMessage);
					}
				} catch (error) {
					setValidation({
						isValidating: false,
						isValid: false,
						error: 'Unable to verify file accessibility',
						suggestion: 'Please check your internet connection and try again',
					});
					onValidation(false, 'Unable to verify file accessibility');
				}
			} else {
				setValidation({
					isValidating: false,
					isValid: false,
					error: result.error,
					suggestion: result.suggestion,
				});
				onValidation(false, result.error);
			}
		}, 500);

		return () => clearTimeout(timeoutId);
	}, [value, onValidation]);

	const getInputClassName = () => {
		let baseClass = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${className}`;

		if (validation.isValidating) {
			return `${baseClass} border-yellow-300 focus:ring-yellow-500`;
		}

		if (value && !validation.isValidating) {
			if (validation.isValid) {
				return `${baseClass} border-green-300 focus:ring-green-500`;
			} else {
				return `${baseClass} border-red-300 focus:ring-red-500`;
			}
		}

		return `${baseClass} border-gray-300 focus:ring-blue-500`;
	};

	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium text-gray-700">{label}</label>

			<div className="relative">
				<input
					type="url"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className={getInputClassName()}
				/>

				{validation.isValidating && (
					<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
						<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
					</div>
				)}

				{!validation.isValidating && value && validation.isValid && (
					<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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
					<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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
			{validation.isValid && !validation.isFolder && onMediaTypeChange && (
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
				<div className="text-sm text-yellow-600">
					⚠️ Folder detected - individual file links recommended for better
					compatibility
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
