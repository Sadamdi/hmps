import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Bug, Download, Eye, FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import RichTextEditor from './rich-text-editor';
import { ContentEnhanceButton } from './content-enhance-button';

interface BugReportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const MAX_FILES = 10;
const MAX_GDRIVE_LINKS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const CODE_EXTENSIONS = new Set([
	'.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs',
	'.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.sql',
	'.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml',
	'.toml', '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.bat', '.ps1',
	'.md', '.txt', '.log', '.env', '.gitignore', '.dockerfile',
]);

function getFileExtension(name: string): string {
	const idx = name.lastIndexOf('.');
	return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function isCodeFile(name: string): boolean {
	return CODE_EXTENSIONS.has(getFileExtension(name));
}

function isImageFile(type: string): boolean {
	return type.startsWith('image/');
}

function isVideoFile(type: string): boolean {
	return type.startsWith('video/');
}

function isPdfFile(type: string): boolean {
	return type === 'application/pdf';
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FilePreview {
	file: File;
	previewUrl?: string;
	textContent?: string;
}

export default function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
	const { toast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [description, setDescription] = useState('');
	const [files, setFiles] = useState<FilePreview[]>([]);
	const [gdriveLinks, setGdriveLinks] = useState<string[]>(['']);
	const [submitting, setSubmitting] = useState(false);
	const [previewFile, setPreviewFile] = useState<FilePreview | null>(null);

	const handleFilesAdd = useCallback(async (newFiles: FileList | null) => {
		if (!newFiles) return;

		const remaining = MAX_FILES - files.length;
		if (remaining <= 0) {
			toast({ title: `Maksimal ${MAX_FILES} file`, variant: 'destructive' });
			return;
		}

		const toAdd: FilePreview[] = [];
		for (let i = 0; i < Math.min(newFiles.length, remaining); i++) {
			const file = newFiles[i];
			if (file.size > MAX_FILE_SIZE) {
				toast({ title: `File "${file.name}" melebihi batas 10MB`, variant: 'destructive' });
				continue;
			}

			const fp: FilePreview = { file };

			if (isImageFile(file.type)) {
				fp.previewUrl = URL.createObjectURL(file);
			} else if (isVideoFile(file.type)) {
				fp.previewUrl = URL.createObjectURL(file);
			} else if (isCodeFile(file.name)) {
				try {
					const text = await file.text();
					fp.textContent = text.slice(0, 5000);
				} catch { /* ignore */ }
			}

			toAdd.push(fp);
		}

		setFiles((prev) => [...prev, ...toAdd]);
	}, [files.length, toast]);

	const removeFile = useCallback((index: number) => {
		setFiles((prev) => {
			const removed = prev[index];
			if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	const addGdriveLink = useCallback(() => {
		if (gdriveLinks.length >= MAX_GDRIVE_LINKS) {
			toast({ title: `Maksimal ${MAX_GDRIVE_LINKS} link GDrive`, variant: 'destructive' });
			return;
		}
		setGdriveLinks((prev) => [...prev, '']);
	}, [gdriveLinks.length, toast]);

	const updateGdriveLink = useCallback((index: number, value: string) => {
		setGdriveLinks((prev) => prev.map((l, i) => (i === index ? value : l)));
	}, []);

	const removeGdriveLink = useCallback((index: number) => {
		setGdriveLinks((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleSubmit = async () => {
		if (!description.trim()) {
			toast({ title: 'Deskripsi bug wajib diisi', variant: 'destructive' });
			return;
		}

		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append('description', description);

			for (const fp of files) {
				formData.append('files', fp.file);
			}

			const validLinks = gdriveLinks.filter((l) => l.trim());
			formData.append('gdriveLinks', JSON.stringify(validLinks));

			const res = await fetch('/api/feedback/bug-report', {
				method: 'POST',
				credentials: 'include',
				body: formData,
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Gagal mengirim bug report' }));
				throw new Error(err.message);
			}

			toast({ title: 'Bug report berhasil dikirim!' });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report'] });
			onOpenChange(false);
			setDescription('');
			setFiles([]);
			setGdriveLinks(['']);
		} catch (err: any) {
			toast({ title: err.message || 'Gagal mengirim bug report', variant: 'destructive' });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-red-600">
							<Bug className="h-5 w-5" />
							Report Bug
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-6">
						<div className="space-y-2">
							<Label className="text-sm font-medium">Deskripsi Bug <span className="text-red-500">*</span></Label>
							<p className="text-xs text-muted-foreground">Jelaskan bug yang Anda temukan secara detail</p>
							<RichTextEditor
								value={description}
								onChange={setDescription}
								placeholder="Jelaskan bug yang Anda temukan..."
								height={250}
							/>
							<ContentEnhanceButton
								entityType="bug_report"
								fields={[{ key: 'description', label: 'Deskripsi Bug' }]}
								values={{ description }}
								onApply={(partial) => {
									if (partial.description !== undefined) {
										setDescription(partial.description);
									}
								}}
							/>
						</div>

						<div className="space-y-3">
							<Label className="text-sm font-medium">Lampiran File</Label>
							<p className="text-xs text-muted-foreground">
								Maks {MAX_FILES} file, masing-masing maks 10MB. Mendukung semua tipe file.
							</p>

							<input
								ref={fileInputRef}
								type="file"
								multiple
								className="hidden"
								onChange={(e) => {
									handleFilesAdd(e.target.files);
									e.target.value = '';
								}}
							/>

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => fileInputRef.current?.click()}
								disabled={files.length >= MAX_FILES}
							>
								<Upload className="h-4 w-4 mr-1" />
								Pilih File ({files.length}/{MAX_FILES})
							</Button>

							{files.length > 0 && (
								<div className="grid gap-2">
									{files.map((fp, i) => (
										<div key={i} className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
											{fp.previewUrl && isImageFile(fp.file.type) ? (
												<img src={fp.previewUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
											) : (
												<FileText className="h-10 w-10 p-2 text-muted-foreground shrink-0" />
											)}
											<div className="min-w-0 flex-1">
												<p className="text-sm truncate">{fp.file.name}</p>
												<p className="text-xs text-muted-foreground">
													{formatFileSize(fp.file.size)}
												</p>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="shrink-0"
												onClick={() => setPreviewFile(fp)}
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="text-destructive shrink-0"
												onClick={() => removeFile(i)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="space-y-3">
							<Label className="text-sm font-medium">Link Google Drive</Label>
							<p className="text-xs text-muted-foreground">
								Maks {MAX_GDRIVE_LINKS} link. Paste link sharing dari Google Drive.
							</p>

							<div className="space-y-2">
								{gdriveLinks.map((link, i) => (
									<div key={i} className="flex gap-2">
										<Input
											placeholder="https://drive.google.com/..."
											value={link}
											onChange={(e) => updateGdriveLink(i, e.target.value)}
											className="flex-1"
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="text-destructive shrink-0"
											onClick={() => removeGdriveLink(i)}
											disabled={gdriveLinks.length <= 1 && !link}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>

							{gdriveLinks.length < MAX_GDRIVE_LINKS && (
								<Button type="button" variant="outline" size="sm" onClick={addGdriveLink}>
									<Plus className="h-4 w-4 mr-1" />
									Tambah link
								</Button>
							)}
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
							Batal
						</Button>
						<Button
							variant="destructive"
							onClick={handleSubmit}
							disabled={submitting || !description.trim()}
						>
							{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bug className="h-4 w-4 mr-1" />}
							Kirim Bug Report
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* File Preview Dialog */}
			<Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
				<DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Eye className="h-5 w-5" />
							{previewFile?.file.name}
						</DialogTitle>
					</DialogHeader>

					{previewFile && (
						<div className="space-y-4">
							<div className="text-sm text-muted-foreground">
								{previewFile.file.type || 'Unknown type'} — {formatFileSize(previewFile.file.size)}
							</div>

							{isImageFile(previewFile.file.type) && previewFile.previewUrl && (
								<img src={previewFile.previewUrl} alt="" className="max-w-full rounded-md" />
							)}

							{isVideoFile(previewFile.file.type) && previewFile.previewUrl && (
								<video src={previewFile.previewUrl} controls className="max-w-full rounded-md" />
							)}

							{isPdfFile(previewFile.file.type) && previewFile.previewUrl && (
								<iframe
									src={URL.createObjectURL(previewFile.file)}
									className="w-full h-[60vh] rounded-md border"
									title="PDF Preview"
								/>
							)}

							{previewFile.textContent && (
								<pre className="p-4 bg-muted rounded-md text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
									{previewFile.textContent}
								</pre>
							)}

							{!isImageFile(previewFile.file.type) &&
								!isVideoFile(previewFile.file.type) &&
								!isPdfFile(previewFile.file.type) &&
								!previewFile.textContent && (
								<div className="flex flex-col items-center gap-4 py-8 text-muted-foreground">
									<FileText className="h-16 w-16" />
									<p>Preview tidak tersedia untuk tipe file ini</p>
								</div>
							)}

							<div className="flex justify-end">
								<Button
									variant="outline"
									onClick={() => {
										const url = URL.createObjectURL(previewFile.file);
										const a = document.createElement('a');
										a.href = url;
										a.download = previewFile.file.name;
										a.click();
										URL.revokeObjectURL(url);
									}}
								>
									<Download className="h-4 w-4 mr-1" />
									Download
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
