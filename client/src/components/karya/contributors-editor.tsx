/**
 * Editor kontributor karya: tambah lewat username/link profil Karya TI atau username/link GitHub,
 * dan sinkron otomatis dari contributor repo GitHub. Kontributor yang punya akun Karya TI
 * mendapat karya ini di profilnya.
 */
import { useState } from 'react';
import { Github, Loader2, RefreshCw, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KaryaAvatar } from '@/components/karya/karya-card';
import { karyaApi } from '@/hooks/use-karya';
import { apiErrorText } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

export interface ContributorRow {
	key: string;
	name: string;
	avatarUrl: string;
	role: string;
	source: 'manual' | 'repo';
	hasAccount: boolean;
	username?: string;
	githubLogin?: string;
}

export interface ContributorCandidate {
	key: string;
	kind: 'student' | 'github';
	username?: string;
	githubLogin?: string;
	name: string;
	avatarUrl: string;
	hasAccount: boolean;
}

export const candidateToRow = (c: ContributorCandidate, source: 'manual' | 'repo'): ContributorRow => ({
	key: c.key,
	name: c.name,
	avatarUrl: c.avatarUrl,
	role: '',
	source,
	hasAccount: c.hasAccount,
	username: c.username,
	githubLogin: c.githubLogin,
});

export function ContributorsEditor({
	rows,
	onChange,
	projectId,
	hasGithubRepo,
	onSynced,
}: {
	rows: ContributorRow[];
	onChange: (rows: ContributorRow[]) => void;
	projectId?: string;
	hasGithubRepo: boolean;
	onSynced?: (rows: ContributorRow[]) => void;
}) {
	const [input, setInput] = useState('');
	const [busy, setBusy] = useState<'' | 'add' | 'sync'>('');
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

	const add = async () => {
		if (!input.trim()) return;
		setBusy('add');
		setMsg(null);
		try {
			const c = await karyaApi<ContributorCandidate>('POST', '/me/contributors/resolve', { input: input.trim() });
			if (rows.some((r) => r.key === c.key)) setMsg({ ok: false, text: `${c.name} sudah ada di daftar` });
			else {
				onChange([...rows, candidateToRow(c, 'manual')]);
				setMsg({ ok: true, text: c.hasAccount ? `${c.name} ditambahkan — karya ini akan muncul di profil Karya TI-nya` : `${c.name} (GitHub) ditambahkan — otomatis tertaut bila nanti membuat akun Karya TI` });
				setInput('');
			}
		} catch (e) {
			setMsg({ ok: false, text: apiErrorText(e, 'Tidak ditemukan') });
		} finally {
			setBusy('');
		}
	};

	const sync = async () => {
		if (!projectId) return;
		setBusy('sync');
		setMsg(null);
		try {
			const p = await karyaApi<{ contributors: ContributorRow[] }>('POST', `/me/projects/${projectId}/contributors/sync`);
			onSynced?.(p.contributors || []);
			setMsg({ ok: true, text: 'Kontributor repo disinkronkan' });
		} catch (e) {
			setMsg({ ok: false, text: apiErrorText(e, 'Gagal sinkron') });
		} finally {
			setBusy('');
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-2">
				<Input
					aria-label="Tambah kontributor"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
					placeholder="username Karya TI, link profil, atau username/link GitHub"
					className="h-11 min-w-[220px] flex-1"
				/>
				<Button type="button" variant="outline" className="h-11" onClick={add} disabled={busy !== '' || !input.trim()}>
					{busy === 'add' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />} Tambah
				</Button>
				{hasGithubRepo && projectId ? (
					<Button type="button" variant="ghost" className="h-11" onClick={sync} disabled={busy !== ''}>
						{busy === 'sync' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Sinkron dari repo
					</Button>
				) : null}
			</div>
			{msg ? <p className={cn('text-xs', msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600')}>{msg.text}</p> : null}
			{rows.length ? (
				<ul className="grid gap-2 sm:grid-cols-2">
					{rows.map((r, i) => (
						<li key={r.key} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
							<KaryaAvatar name={r.name} url={r.avatarUrl} className="h-9 w-9 shrink-0 text-xs" />
							<div className="min-w-0 flex-1 space-y-1">
								<div className="flex items-center gap-1.5">
									<span className="truncate text-sm font-medium">{r.name}</span>
									{r.hasAccount ? (
										<span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Karya TI</span>
									) : (
										<span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
											<Github className="h-3 w-3" /> GitHub
										</span>
									)}
									{r.source === 'repo' ? <span className="shrink-0 text-[10px] text-muted-foreground">dari repo</span> : null}
								</div>
								<Input
									aria-label={`Peran ${r.name}`}
									value={r.role}
									maxLength={60}
									onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
									placeholder="Peran, mis. Frontend"
									className="h-7 text-xs"
								/>
							</div>
							<button type="button" aria-label={`Hapus ${r.name}`} className="self-start text-muted-foreground hover:text-destructive" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
								<X className="h-4 w-4" />
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-xs text-muted-foreground">
					Belum ada kontributor. {hasGithubRepo ? 'Contributor repo GitHub otomatis ditambahkan saat info repo diambil.' : 'Kerja tim? Tambahkan teman satu timmu di sini.'}
				</p>
			)}
		</div>
	);
}
