import { Star } from 'lucide-react';
import type { FeedbackDestination } from '@shared/schema';

const FIELD_KIND_LABEL: Record<string, string> = {
	short_text: 'Jawaban singkat',
	textarea: 'Jawaban panjang',
	rich_html: 'Teks berformat',
	select: 'Pilihan tunggal',
	checkbox: 'Centang',
	multi_select: 'Pilihan ganda',
	file: 'Lampiran (unggah)',
};

function PreviewStars() {
	return (
		<span className="inline-flex gap-0.5">
			{[1, 2, 3, 4, 5].map((i) => (
				<Star key={i} className="h-4 w-4 fill-none text-muted-foreground/40" />
			))}
		</span>
	);
}

export default function FeedbackFormPreview({ destination }: { destination: FeedbackDestination }) {
	const sortedFields = [...destination.fields].sort((a, b) => a.order - b.order);
	const sortedTypes = [...destination.types].sort((a, b) => a.order - b.order);

	return (
		<div className="max-w-lg w-full mx-auto">
			<div className="rounded-2xl border bg-background p-6 sm:p-7 space-y-5 shadow-md ring-1 ring-border/60">
				<p className="text-center text-xs font-medium text-muted-foreground tracking-wide mb-1">Pratinjau — tampilan pengunjung</p>

				<div>
					<label className="text-sm font-medium block mb-1.5">Formulir dipilih</label>
					<div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary">
						{destination.label || '(isi nama formulir)'}
					</div>
				</div>

				{sortedTypes.length > 0 && (
					<div>
						<label className="text-sm font-medium block mb-1.5">Jenis masukan</label>
						<div className="flex gap-2 flex-wrap">
							{sortedTypes.map((t, i) => (
								<span
									key={t.id}
									className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${i === 0 ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
								>
									{t.label || '(nama jenis)'}
								</span>
							))}
						</div>
					</div>
				)}

				<div className="flex items-center justify-between">
					<label className="text-sm font-medium">Kirim sebagai Anonim</label>
					<div className="relative w-11 h-6 rounded-full bg-muted-foreground/30">
						<span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
					</div>
				</div>

				<div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
					{['Nama', 'NIM', 'Email'].map((lbl) => (
						<div key={lbl}>
							<label className="text-xs font-medium block mb-0.5">{lbl}</label>
							<div className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground/40 h-9 flex items-center">
								{lbl === 'Nama' ? 'Nama lengkap' : lbl === 'NIM' ? 'Nomor Induk Mahasiswa' : 'Email aktif'}
							</div>
						</div>
					))}
				</div>

				{sortedFields.map((f) => {
					const req = f.required ? <span className="text-red-500 ml-0.5">*</span> : null;
					const kindBadge = (
						<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-2">
							{FIELD_KIND_LABEL[f.kind] || f.kind}
						</span>
					);

					if (f.kind === 'short_text') {
						return (
							<div key={f.id}>
								<label className="text-sm font-medium block mb-1.5">{f.label || '(isi judul)'}{req}{kindBadge}</label>
								<div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground/40 h-9 flex items-center">
									{f.placeholder || 'Teks pendek...'}
								</div>
								{f.helpText && <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p>}
							</div>
						);
					}

					if (f.kind === 'textarea') {
						return (
							<div key={f.id}>
								<label className="text-sm font-medium block mb-1.5">{f.label || '(isi judul)'}{req}{kindBadge}</label>
								<div className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground/40 min-h-[80px] flex items-start">
									{f.placeholder || 'Tuliskan masukan Anda...'}
								</div>
								{f.helpText && <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p>}
							</div>
						);
					}

					if (f.kind === 'rich_html') {
						return (
							<div key={f.id}>
								<label className="text-sm font-medium block mb-1.5">{f.label || '(isi judul)'}{req}{kindBadge}</label>
								<div className="w-full rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground text-center min-h-[80px] flex items-center justify-center">
									Area editor rich text (TinyMCE)
								</div>
								{f.helpText && <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p>}
							</div>
						);
					}

					if (f.kind === 'select') {
						return (
							<div key={f.id}>
								<label className="text-sm font-medium block mb-1.5">{f.label || '(isi judul)'}{req}{kindBadge}</label>
								<div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground/40 h-9 flex items-center justify-between">
									<span>Pilih...</span>
									<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
								</div>
								{(f.options?.length ?? 0) > 0 && (
									<p className="text-xs text-muted-foreground mt-1">Opsi: {f.options!.join(', ')}</p>
								)}
							</div>
						);
					}

					if (f.kind === 'checkbox') {
						return (
							<label key={f.id} className="flex items-center gap-2 text-sm py-1">
								<div className="h-4 w-4 rounded border border-border bg-background/50" />
								<span>{f.label || '(isi judul)'}{req}{kindBadge}</span>
							</label>
						);
					}

					if (f.kind === 'multi_select') {
						return (
							<div key={f.id}>
								<p className="text-sm font-medium block mb-1.5">{f.label || '(isi judul)'}{req}{kindBadge}</p>
								<div className="space-y-1 pl-0.5">
									{(f.options?.length ?? 0) > 0 ? f.options!.map((opt) => (
										<label key={opt} className="flex items-center gap-2 text-sm">
											<div className="h-4 w-4 rounded border border-border bg-background/50" />
											{opt}
										</label>
									)) : (
										<p className="text-xs text-muted-foreground">Belum ada opsi</p>
									)}
								</div>
							</div>
						);
					}

					if (f.kind === 'file') {
						return (
							<div key={f.id}>
								<label className="text-sm font-medium block mb-1.5">
									{f.label || '(isi judul)'}{req}{kindBadge}
									<span className="text-muted-foreground font-normal ml-1">(maks {f.maxFiles ?? 10} file)</span>
								</label>
								<div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground text-center">
									Klik untuk mengunggah lampiran (saat ini hanya gambar)
								</div>
								{f.helpText && <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p>}
							</div>
						);
					}

					return null;
				})}

				{destination.ratings.length > 0 && (
					<div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
						<p className="text-sm font-medium mb-2">Rating <span className="text-muted-foreground font-normal">(opsional, 1–5)</span></p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{destination.ratings.map((dim) => (
								<div key={dim.id} className="flex items-center justify-between gap-2">
									<span className="text-xs text-muted-foreground">{dim.label || '(isi judul)'}</span>
									<PreviewStars />
								</div>
							))}
						</div>
					</div>
				)}

				<button
					type="button"
					disabled
					className="w-full py-2.5 rounded-lg bg-primary/60 text-primary-foreground font-medium text-sm cursor-not-allowed opacity-70"
				>
					Kirim
				</button>
			</div>
		</div>
	);
}
