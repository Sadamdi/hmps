/**
 * Onboarding wajib setelah aktivasi: pilih username Karya TI.
 * Dua cara: tulis sendiri, atau impor dari link/username GitHub · GitLab · Bitbucket
 * (username Karya TI otomatis = username akun Git, data profil kosong ikut terisi).
 * Login tetap memakai email + password (username tidak bisa dipakai login).
 */
import { useEffect, useState } from 'react';
import { Check, Github, Gitlab, Loader2, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { karyaApi, refreshStudent, type KaryaStudentAccount } from '@/hooks/use-karya';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText } from '@/lib/queryClient';

type Provider = 'github' | 'gitlab' | 'bitbucket';

export interface GitProfileImport {
	provider: Provider;
	login: string;
	name: string;
	bio: string;
	website: string;
	location: string;
	avatarUrl: string;
	profileUrl: string;
	profileReadmeHtml: string;
	suggestedUsername: string;
	suggestedValid: boolean;
	suggestedAvailable: boolean;
}

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

function useUsernameCheck(value: string) {
	const [state, setState] = useState<{ checking: boolean; available: boolean | null }>({ checking: false, available: null });
	useEffect(() => {
		const u = value.trim().toLowerCase();
		if (!USERNAME_RE.test(u)) {
			setState({ checking: false, available: null });
			return;
		}
		setState({ checking: true, available: null });
		const t = setTimeout(async () => {
			try {
				const r = await karyaApi<{ available: boolean }>('GET', `/me/username-available?u=${encodeURIComponent(u)}`);
				setState({ checking: false, available: r.available });
			} catch {
				setState({ checking: false, available: null });
			}
		}, 400);
		return () => clearTimeout(t);
	}, [value]);
	return state;
}

/** Simpan hasil impor ke profil: hanya mengisi kolom yang masih kosong. */
export function buildProfilePatchFromImport(g: GitProfileImport, student: KaryaStudentAccount) {
	const social = { ...(student.social as Record<string, string>) };
	social[g.provider] = social[g.provider] || g.profileUrl;
	if (g.website && !social.website) social.website = g.website;
	const patch: Record<string, unknown> = { social };
	if (!student.bio && g.bio) patch.bio = g.bio;
	if (!student.headline && g.bio) patch.headline = g.bio.split(/[.\n]/)[0].slice(0, 120);
	if (!student.profileReadme && g.profileReadmeHtml) patch.profileReadme = g.profileReadmeHtml;
	if (!student.avatarUrl && g.avatarUrl) patch.avatarUrl = g.avatarUrl;
	return patch;
}

export function UsernameOnboarding({ student }: { student: KaryaStudentAccount }) {
	const { toast } = useToast();
	const [open, setOpen] = useState(!student.usernameSet);
	const [tab, setTab] = useState<'import' | 'manual'>('import');
	const [username, setUsername] = useState(student.usernameSet ? student.username : '');
	const [source, setSource] = useState('');
	const [provider, setProvider] = useState<Provider>('github');
	const [importing, setImporting] = useState(false);
	const [imported, setImported] = useState<GitProfileImport | null>(null);
	const [saving, setSaving] = useState(false);
	const check = useUsernameCheck(username);

	useEffect(() => setOpen(!student.usernameSet), [student.usernameSet]);
	if (student.usernameSet) return null;

	const runImport = async () => {
		if (!source.trim()) return toast({ title: 'Isi link profil atau username dulu', variant: 'destructive' });
		setImporting(true);
		try {
			const g = await karyaApi<GitProfileImport>('POST', '/me/profile/import', { source: source.trim(), provider });
			setImported(g);
			setUsername(g.suggestedUsername);
		} catch (e) {
			toast({ title: 'Gagal mengimpor', description: apiErrorText(e, 'Periksa link/username'), variant: 'destructive' });
		} finally {
			setImporting(false);
		}
	};

	const save = async () => {
		const u = username.trim().toLowerCase();
		if (!USERNAME_RE.test(u)) return toast({ title: 'Username tidak valid', description: '3–30 karakter: huruf kecil, angka, tanda minus.', variant: 'destructive' });
		setSaving(true);
		try {
			const extra = imported && tab === 'import' ? buildProfilePatchFromImport(imported, student) : {};
			await karyaApi('PATCH', '/me/profile', { ...extra, username: u });
			refreshStudent();
			toast({ title: 'Username disimpan', description: `Profil publikmu: /ruang-mahasiswa/mahasiswa/${u}` });
		} catch (e) {
			toast({ title: 'Gagal menyimpan', description: apiErrorText(e, 'Coba username lain'), variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	const status = !username
		? null
		: !USERNAME_RE.test(username.trim().toLowerCase())
			? { ok: false, text: '3–30 karakter: huruf kecil, angka, tanda minus (tidak di awal/akhir)' }
			: check.checking
				? { ok: null, text: 'Memeriksa…' }
				: check.available === false
					? { ok: false, text: 'Sudah dipakai — coba variasi lain' }
					: check.available
						? { ok: true, text: 'Tersedia' }
						: null;

	const usernameField = (
		<div className="space-y-1.5">
			<Label htmlFor="onb-username">Username Karya TI</Label>
			<div className="flex items-center rounded-md border border-input bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
				<span className="shrink-0 text-muted-foreground">/ruang-mahasiswa/mahasiswa/</span>
				<input
					id="onb-username"
					value={username}
					onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
					className="h-9 min-w-0 flex-1 bg-transparent px-1 outline-none"
					placeholder="username-kamu"
					autoComplete="off"
					maxLength={30}
				/>
			</div>
			{status ? (
				<p className={`flex items-center gap-1 text-xs ${status.ok === true ? 'text-emerald-600' : status.ok === false ? 'text-red-600' : 'text-muted-foreground'}`}>
					{status.ok === true ? <Check className="h-3.5 w-3.5" /> : status.ok === false ? <X className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
					{status.text}
				</p>
			) : null}
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={() => { /* wajib diselesaikan */ }}>
			<DialogContent className="w-[calc(100vw-2rem)] max-w-lg [&>button.absolute]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle>Buat username dulu, yuk</DialogTitle>
					<DialogDescription>
						Username jadi alamat profil publikmu dan bisa diganti kapan saja di tab Profil (link lama otomatis dialihkan). Login tetap
						memakai <strong>email kampus + password</strong>, bukan username.
					</DialogDescription>
				</DialogHeader>
				<Tabs value={tab} onValueChange={(v) => setTab(v as 'import' | 'manual')}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="import">Impor akun Git</TabsTrigger>
						<TabsTrigger value="manual">Tulis sendiri</TabsTrigger>
					</TabsList>
					<TabsContent value="import" className="space-y-3 pt-2">
						<p className="text-xs text-muted-foreground">
							Tempel link profil (github.com/…, gitlab.com/…, bitbucket.org/…) atau ketik username dan pilih layanannya. Username Karya TI
							otomatis sama dengan username akunmu, dan nama/bio/foto/README yang masih kosong ikut terisi.
						</p>
						<div className="flex gap-1.5">
							{(['github', 'gitlab', 'bitbucket'] as Provider[]).map((p) => (
								<Button key={p} type="button" size="sm" variant={provider === p ? 'default' : 'outline'} className="h-8 capitalize" onClick={() => setProvider(p)}>
									{p === 'github' ? <Github className="mr-1 h-3.5 w-3.5" /> : p === 'gitlab' ? <Gitlab className="mr-1 h-3.5 w-3.5" /> : <UserRound className="mr-1 h-3.5 w-3.5" />}
									{p === 'github' ? 'GitHub' : p === 'gitlab' ? 'GitLab' : 'Bitbucket'}
								</Button>
							))}
						</div>
						<div className="flex gap-2">
							<Input value={source} onChange={(e) => setSource(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runImport())} placeholder="https://github.com/username atau username" />
							<Button type="button" onClick={runImport} disabled={importing}>
								{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Impor'}
							</Button>
						</div>
						{imported ? (
							<div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
								{imported.avatarUrl ? <img src={imported.avatarUrl} alt="" className="h-10 w-10 rounded-full" /> : null}
								<div className="min-w-0">
									<p className="font-medium">{imported.name || imported.login}</p>
									<p className="truncate text-xs text-muted-foreground">{imported.profileUrl}</p>
								</div>
							</div>
						) : null}
						{imported ? usernameField : null}
					</TabsContent>
					<TabsContent value="manual" className="space-y-3 pt-2">
						{usernameField}
					</TabsContent>
				</Tabs>
				<Button type="button" onClick={save} disabled={saving || !username || check.available === false || (tab === 'import' && !imported)} className="w-full">
					{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Simpan & lanjut
				</Button>
			</DialogContent>
		</Dialog>
	);
}
