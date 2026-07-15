import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	decodeUinMalangNim,
	PRODI_EXAMPLE_EMAIL,
	PRODI_EXAMPLE_NIM,
	UIN_CAMPUS_PROGRAM_CATALOG,
	UIN_FACULTY_CODES,
	type NimDecodeResult,
	type ProdiPortalLink,
	type ProdiStudentGuide,
} from '@shared/prodi-student-hub';
import {
	BookMarked,
	CalendarDays,
	ExternalLink,
	FileText,
	GraduationCap,
	Link2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

function ExtLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
	const isInternal = href.startsWith('/');
	return (
		<a
			href={href}
			target={isInternal ? undefined : '_blank'}
			rel={isInternal ? undefined : 'noopener noreferrer'}
			className={cn('inline-flex items-center gap-1 text-primary hover:underline', className)}>
			{children}
			{!isInternal && <ExternalLink className="h-3.5 w-3.5 shrink-0" />}
		</a>
	);
}

export function KalenderSection({ calendars }: { calendars: Record<string, any> }) {
	const years = useMemo(
		() =>
			Object.keys(calendars || {})
				.map(Number)
				.filter((y) => Number.isFinite(y))
				.sort((a, b) => b - a),
		[calendars],
	);
	const [year, setYear] = useState<string>(years[0] ? String(years[0]) : '');
	const [showPreview, setShowPreview] = useState(false);

	if (!years.length) {
		return (
			<p className="text-center text-muted-foreground py-12">
				Kalender akademik belum tersedia. Jalankan sync Kalender dari dashboard.
			</p>
		);
	}

	const effectiveYear = year && calendars[year] ? year : String(years[0]);
	const data = calendars[effectiveYear];
	const localPdf = data?.pdfUrl && String(data.pdfUrl).startsWith('/uploads/') ? data.pdfUrl : '';
	const downloadHref = localPdf || data?.sourcePdfUrl || '';
	const previewHref = localPdf || '';

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
				<div>
					<h2 className="text-xl font-semibold flex items-center gap-2">
						<CalendarDays className="h-5 w-5 text-primary" /> Kalender Akademik UIN
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Kalender resmi universitas (berlaku untuk mahasiswa TI). PDF di-cache lokal setelah sync.
					</p>
				</div>
				<Select
					value={effectiveYear}
					onValueChange={(v) => {
						setYear(v);
						setShowPreview(false);
					}}>
					<SelectTrigger className="w-full sm:w-48">
						<SelectValue placeholder="Pilih tahun" />
					</SelectTrigger>
					<SelectContent>
						{years.map((y) => (
							<SelectItem key={y} value={String(y)}>
								{calendars[String(y)]?.academicYear || `${y}/${y + 1}`}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{data && (
				<div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-4">
					<div>
						<h3 className="font-semibold text-lg">{data.title || `Kalender ${data.academicYear}`}</h3>
						{data.rectorDecision && (
							<p className="text-sm text-muted-foreground mt-1 line-clamp-3">
								Keputusan: {data.rectorDecision}
							</p>
						)}
						<p className="text-xs text-muted-foreground mt-1">
							Sumber: {data.sourceKind || 'sync'}
							{data.syncedAt ? ` · ${new Date(data.syncedAt).toLocaleDateString('id-ID')}` : ''}
						</p>
					</div>

					{Array.isArray(data.highlights) && data.highlights.length > 0 && (
						<ul className="space-y-2 text-sm list-disc list-inside text-muted-foreground">
							{data.highlights.slice(0, 8).map((h: string, i: number) => (
								<li key={i}>{h}</li>
							))}
						</ul>
					)}

					<div className="flex flex-wrap gap-3">
						{downloadHref && (
							<a
								href={downloadHref}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
								<FileText className="h-4 w-4" /> Unduh PDF
							</a>
						)}
						{previewHref && (
							<button
								type="button"
								onClick={() => setShowPreview((v) => !v)}
								className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
								{showPreview ? 'Sembunyikan pratinjau' : 'Pratinjau PDF'}
							</button>
						)}
						{!previewHref && data.sourcePdfUrl && (
							<p className="text-xs text-amber-700 dark:text-amber-400 w-full">
								Pratinjau lokal belum tersedia — gunakan Unduh PDF (sumber resmi) atau sync ulang dari
								dashboard.
							</p>
						)}
						{data.announcementUrl && (
							<ExtLink href={data.announcementUrl}>Sumber resmi</ExtLink>
						)}
					</div>

					{showPreview && previewHref && (
						<div className="hidden md:block rounded-md border border-border overflow-hidden bg-muted/30">
							<iframe title="Kalender PDF" src={previewHref} className="w-full h-[70vh]" />
						</div>
					)}
					{showPreview && (
						<p className="md:hidden text-xs text-muted-foreground">
							Pratinjau PDF optimal di desktop. Di mobile, gunakan Unduh PDF.
						</p>
					)}
				</div>
			)}
		</div>
	);
}

export function PortalSection({
	portals,
	guides,
}: {
	portals: ProdiPortalLink[];
	guides: ProdiStudentGuide[];
}) {
	const [nimInput, setNimInput] = useState('');
	const decoded: NimDecodeResult = useMemo(() => decodeUinMalangNim(nimInput), [nimInput]);
	const facultyList = useMemo(
		() => Object.values(UIN_FACULTY_CODES).sort((a, b) => a.code.localeCompare(b.code)),
		[],
	);
	const catalogByFaculty = useMemo(() => {
		const map = new Map<string, typeof UIN_CAMPUS_PROGRAM_CATALOG>();
		for (const p of UIN_CAMPUS_PROGRAM_CATALOG) {
			const list = map.get(p.facultyCode) || [];
			list.push(p);
			map.set(p.facultyCode, list);
		}
		return map;
	}, []);

	const groups: { key: string; label: string }[] = [
		{ key: 'daily', label: 'Portal harian' },
		{ key: 'maba', label: 'Maba / Ma\'had' },
		{ key: 'graduate', label: 'Menjelang lulus' },
		{ key: 'research', label: 'Riset' },
	];

	return (
		<div className="space-y-10">
			<section className="space-y-4">
				<h2 className="text-xl font-semibold flex items-center gap-2">
					<Link2 className="h-5 w-5 text-primary" /> Portal mahasiswa
				</h2>
				<p className="text-sm text-muted-foreground">
					Tautan resmi kampus. Data privat (nilai, KRS, UKT detail) hanya di SIAKAD setelah login.
				</p>
				{groups.map((g) => {
					const items = (portals || []).filter((p) => (p.group || 'daily') === g.key);
					if (!items.length) return null;
					return (
						<div key={g.key} className="space-y-2">
							<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{g.label}</h3>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{items.map((p) => (
									<a
										key={p.url + p.label}
										href={p.url}
										target="_blank"
										rel="noopener noreferrer"
										className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
										<div className="font-medium flex items-center gap-1">
											{p.label} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
										</div>
										<p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
									</a>
								))}
							</div>
						</div>
					);
				})}
			</section>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold flex items-center gap-2">
					<GraduationCap className="h-5 w-5 text-primary" /> Panduan & decoder NIM
				</h2>
				<div className="rounded-lg border border-border bg-card p-4 space-y-3">
					<p className="text-sm text-muted-foreground">
						Contoh NIM: <code className="text-xs bg-muted px-1 rounded">{PRODI_EXAMPLE_NIM}</code> · Email:{' '}
						<code className="text-xs bg-muted px-1 rounded">{PRODI_EXAMPLE_EMAIL}</code>
					</p>
					<Input
						inputMode="numeric"
						placeholder={`Coba decode NIM (contoh ${PRODI_EXAMPLE_NIM})`}
						value={nimInput}
						onChange={(e) => setNimInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
						maxLength={12}
						aria-label="Decoder NIM"
					/>
					{nimInput && (
						<div className="text-sm space-y-1 rounded-md bg-muted/40 p-3">
							<p className="font-medium">{decoded.message}</p>
							{decoded.ok && (
								<ul className="list-disc list-inside text-muted-foreground">
									<li>Angkatan: {decoded.year}</li>
									<li>
										Fakultas ({decoded.facultyCode}): {decoded.facultyName}
										{decoded.knownFaculty === false ? ' — tidak ditemukan' : ''}
									</li>
									<li>
										Prodi ({decoded.prodiCode}): {decoded.prodiName}
										{decoded.knownProdi === false ? ' — tidak ditemukan' : ''}
									</li>
									<li>
										Jenjang (digit 7): {decoded.jenjangDigit}
										{decoded.jenjang ? ` — ${decoded.jenjang}` : ''}
									</li>
									<li>
										Semester masuk (digit 8): {decoded.semesterDigit}
										{decoded.semesterLabel ? ` — ${decoded.semesterLabel}` : ''}
									</li>
									<li>Nomor urut: {decoded.serial}</li>
									{decoded.isTiModern && (
										<li className="text-primary">Ini pola NIM S1 Teknik Informatika.</li>
									)}
								</ul>
							)}
							{decoded.notes?.map((n, i) => (
								<p key={i} className="text-xs text-amber-700 dark:text-amber-400 mt-1">
									{n}
								</p>
							))}
							{!!decoded.relatedPrograms?.length && (
								<div className="mt-2 text-xs text-muted-foreground">
									<p className="font-medium text-foreground">Program kampus terkait unit ini:</p>
									<ul className="list-disc list-inside mt-1">
										{decoded.relatedPrograms.slice(0, 12).map((p) => (
											<li key={`${p.facultyCode}-${p.jenjang}-${p.name}`}>
												[{p.jenjang}] {p.name}
												{p.prodiCode ? ` (PP ${p.prodiCode})` : ' (kode digit belum publik)'}
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					)}

					<details className="rounded-md border border-border p-3 text-sm">
						<summary className="cursor-pointer font-medium">
							Katalog lengkap fakultas & prodi UIN Malang (S1–S3 + profesi)
						</summary>
						<div className="mt-3 space-y-4 max-h-96 overflow-y-auto">
							<p className="text-xs text-muted-foreground">
								Format: <code className="bg-muted px-1 rounded">YY FF PP J S NNNN</code> (J=jenjang,
								S=semester). Sumber daftar: PMB + MSAA + Pedoman Pascasarjana 2026. Digit PP S1
								terkonfirmasi MSAA; S2/S3/profesi tanpa angka publik ditandai “kode belum publik”.
							</p>
							{facultyList.map((fac) => {
								const programs = catalogByFaculty.get(fac.code) || [];
								return (
									<div key={fac.code}>
										<p className="font-medium">
											{fac.code} — {fac.shortName}
										</p>
										<ul className="mt-1 text-muted-foreground list-disc list-inside">
											{programs.map((p) => (
												<li key={`${p.facultyCode}-${p.jenjang}-${p.name}`}>
													[{p.jenjang}] {p.name}
													{p.prodiCode ? ` · PP ${p.prodiCode}` : ' · kode digit belum publik'}
												</li>
											))}
											{!programs.length && <li>Belum ada entri katalog</li>}
										</ul>
									</div>
								);
							})}
						</div>
					</details>
				</div>

				<div className="space-y-3">
					{(guides || []).map((guide) => (
						<details
							key={guide.id}
							className="group rounded-lg border border-border bg-card open:shadow-sm">
							<summary className="cursor-pointer list-none px-4 py-3 font-medium flex items-center justify-between gap-2">
								<span>{guide.title}</span>
								<span className="text-xs text-muted-foreground font-normal">{guide.audience}</span>
							</summary>
							<div className="px-4 pb-4 space-y-3 text-sm border-t border-border pt-3">
								<p className="text-muted-foreground">{guide.summary}</p>
								{guide.exampleEmail && (
									<p>
										Contoh email: <code className="bg-muted px-1 rounded text-xs">{guide.exampleEmail}</code>
									</p>
								)}
								{guide.nimExample && (
									<p>
										Contoh NIM: <code className="bg-muted px-1 rounded text-xs">{guide.nimExample}</code>
									</p>
								)}
								{guide.steps && guide.steps.length > 0 && (
									<ol className="list-decimal list-inside space-y-2">
										{guide.steps.map((s) => (
											<li key={s.order}>
												<span className="font-medium">{s.title}</span> — {s.body}{' '}
												{s.ctaUrl && s.ctaLabel && (
													<ExtLink href={s.ctaUrl}>{s.ctaLabel}</ExtLink>
												)}
											</li>
										))}
									</ol>
								)}
								{guide.links && guide.links.length > 0 && (
									<ul className="space-y-1">
										{guide.links.map((l) => (
											<li key={l.url}>
												<ExtLink href={l.url}>{l.label}</ExtLink>
												{l.desc ? <span className="text-muted-foreground"> — {l.desc}</span> : null}
											</li>
										))}
									</ul>
								)}
								{guide.tips && (
									<ul className="list-disc list-inside text-muted-foreground">
										{guide.tips.map((t, i) => (
											<li key={i}>{t}</li>
										))}
									</ul>
								)}
								{guide.warnings && (
									<ul className="list-disc list-inside text-amber-700 dark:text-amber-400">
										{guide.warnings.map((w, i) => (
											<li key={i}>{w}</li>
										))}
									</ul>
								)}
							</div>
						</details>
					))}
				</div>
			</section>
		</div>
	);
}

export function HubResourceSection({
	title,
	hub,
	emptyHint,
}: {
	title: string;
	hub: any;
	emptyHint: string;
}) {
	if (!hub?.hubUrl && !hub?.templates?.length && !hub?.pedomanPdf && !hub?.documents?.length) {
		return <p className="text-center text-muted-foreground py-12">{emptyHint}</p>;
	}
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold flex items-center gap-2">
					<BookMarked className="h-5 w-5 text-primary" /> {title}
				</h2>
				{hub.hubUrl && (
					<p className="text-sm text-muted-foreground mt-1">
						Sumber:{' '}
						<ExtLink href={hub.hubUrl}>{hub.hubUrl.replace(/^https?:\/\//, '')}</ExtLink>
						{hub.syncedAt
							? ` · sync ${new Date(hub.syncedAt).toLocaleDateString('id-ID')}`
							: ''}
					</p>
				)}
			</div>
			{Array.isArray(hub.steps) && hub.steps.length > 0 && (
				<ol className="list-decimal list-inside space-y-1 text-sm">
					{hub.steps.map((s: string, i: number) => (
						<li key={i}>{s}</li>
					))}
				</ol>
			)}
			{Array.isArray(hub.registrationHints) && (
				<ul className="list-disc list-inside text-sm text-muted-foreground">
					{hub.registrationHints.map((h: string, i: number) => (
						<li key={i}>{h}</li>
					))}
				</ul>
			)}
			{Array.isArray(hub.sections) && hub.sections.length > 0 && (
				<div className="space-y-3">
					{hub.sections.map((sec: any, i: number) => (
						<details key={i} className="rounded-lg border border-border bg-card p-4">
							<summary className="cursor-pointer font-medium">{sec.heading}</summary>
							{sec.body && (
								<p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{sec.body}</p>
							)}
							{Array.isArray(sec.links) && sec.links.length > 0 && (
								<ul className="mt-2 space-y-1 text-sm">
									{sec.links.map((l: any, j: number) => (
										<li key={j}>
											<ExtLink href={l.url}>{l.label}</ExtLink>
										</li>
									))}
								</ul>
							)}
						</details>
					))}
				</div>
			)}
			<div className="flex flex-wrap gap-3">
				{hub.hubUrl && (
					<a
						href={hub.hubUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
						Buka halaman resmi <ExternalLink className="h-4 w-4" />
					</a>
				)}
				{hub.pedomanPdf && (
					<a
						href={hub.pedomanPdf}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm">
						Pedoman PDF
					</a>
				)}
				{hub.sopPdf && (
					<a
						href={hub.sopPdf}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm">
						SOP / dokumen
					</a>
				)}
			</div>
			{(Array.isArray(hub.documents) && hub.documents.length > 0) ||
			(Array.isArray(hub.templates) && hub.templates.length > 0) ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{(hub.documents || hub.templates || []).map((t: { name: string; url: string }, i: number) => (
						<a
							key={(t.url || '') + i}
							href={t.url}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg border border-border p-3 text-sm hover:border-primary/40">
							{t.name || 'Template'} <ExternalLink className="inline h-3.5 w-3.5 ml-1" />
						</a>
					))}
				</div>
			) : null}
			{Array.isArray(hub.actionLinks) && hub.actionLinks.length > 0 && (
				<ul className="space-y-1 text-sm">
					{hub.actionLinks.map((l: any, i: number) => (
						<li key={i}>
							<ExtLink href={l.url}>{l.label}</ExtLink>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const ANNOUNCEMENT_CATS: { id: string; label: string }[] = [
	{ id: 'all', label: 'Semua' },
	{ id: 'thesis', label: 'Skripsi / Thesis' },
	{ id: 'wisuda', label: 'Wisuda' },
	{ id: 'ukt', label: 'UKT / Registrasi' },
	{ id: 'kalender', label: 'Kalender' },
	{ id: 'lainnya', label: 'Lainnya' },
];

export function PengumumanSection({ items }: { items: any[] }) {
	const [cat, setCat] = useState('all');
	const filtered = useMemo(() => {
		const list = items || [];
		if (cat === 'all') return list;
		return list.filter((i) => (i.category || 'lainnya') === cat);
	}, [items, cat]);

	if (!items?.length) {
		return (
			<p className="text-center text-muted-foreground py-12">
				Belum ada pengumuman tersinkron. Jalankan sync Student Resources dari dashboard.
			</p>
		);
	}
	return (
		<div className="space-y-4">
			<h2 className="text-xl font-semibold">Pengumuman penting</h2>
			<p className="text-sm text-muted-foreground">
				Filter dari feed resmi TI (skripsi/sidang) dan UIN (wisuda, UKT, kalender). Auto-refresh harian
				dari dashboard.
			</p>
			<div className="flex flex-wrap gap-2">
				{ANNOUNCEMENT_CATS.map((c) => (
					<button
						key={c.id}
						type="button"
						onClick={() => setCat(c.id)}
						className={cn(
							'rounded-md border px-3 py-1.5 text-xs sm:text-sm transition-colors',
							cat === c.id
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border text-muted-foreground hover:bg-muted',
						)}>
						{c.label}
					</button>
				))}
			</div>
			<ul className="divide-y divide-border rounded-lg border border-border bg-card">
				{filtered.map((item, i) => (
					<li key={(item.url || '') + i} className="p-4 hover:bg-muted/30">
						<a
							href={item.url}
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium text-foreground hover:text-primary flex items-start gap-2">
							<span className="flex-1">{item.title}</span>
							<ExternalLink className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
						</a>
						<p className="text-xs text-muted-foreground mt-1">
							{item.source === 'ti' ? 'Teknik Informatika' : 'UIN Malang'}
							{item.category ? ` · ${item.category}` : ''}
							{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString('id-ID')}` : ''}
						</p>
						{item.excerpt && (
							<p className="text-sm text-muted-foreground mt-2 line-clamp-3">{item.excerpt}</p>
						)}
					</li>
				))}
				{!filtered.length && (
					<li className="p-6 text-center text-sm text-muted-foreground">
						Tidak ada pengumuman di kategori ini.
					</li>
				)}
			</ul>
		</div>
	);
}

