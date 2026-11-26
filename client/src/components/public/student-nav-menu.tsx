import { KaryaAvatar } from '@/components/karya/karya-card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useBuyer, useStorePaths } from '@/hooks/use-buyer';
import { KARYA_PATHS, karyaApi, useStudent } from '@/hooks/use-karya';
import { queryClient } from '@/lib/queryClient';
import { ExternalLink, FolderKanban, LogOut, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

/** Menu profil mahasiswa (Karya TI) di kanan atas navbar — setara menu akun pembeli. */
export function StudentNavMenu({ variant }: { variant: 'desktop' | 'icon' }) {
	const { student } = useStudent();
	const { buyer } = useBuyer();
	const { accountHref } = useStorePaths();
	const [busy, setBusy] = useState(false);
	if (!student) return null;
	const firstName = (student.name || student.email).split(/[\s@]/)[0] || 'Akun';

	const logout = async () => {
		setBusy(true);
		await karyaApi('POST', '/auth/logout').catch(() => null);
		queryClient.setQueryData(['karya-me'], null);
		window.location.assign('/');
	};

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				{variant === 'desktop' ? (
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(37,99,235,0.3)] transition-all duration-200 hover:scale-[1.03]">
						<KaryaAvatar name={student.name} url={student.avatarUrl} className="h-6 w-6 text-[10px]" />
						{firstName}
					</button>
				) : (
					<button
						type="button"
						aria-label="Akun mahasiswa"
						className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)] transition-all duration-200 hover:scale-105">
						<KaryaAvatar name={student.name} url={student.avatarUrl} className="h-8 w-8 text-xs" />
					</button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="z-50 w-64 border-border bg-card text-foreground">
				<div className="px-3 py-2">
					<p className="truncate text-sm font-medium">{student.name || firstName}</p>
					<p className="truncate text-xs text-muted-foreground">{student.email}</p>
					<p className="mt-0.5 text-[11px] text-muted-foreground">Akun Mahasiswa TI{student.emailVerified ? '' : ' · belum aktivasi'}</p>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={KARYA_PATHS.dashboard} className="cursor-pointer">
						<FolderKanban className="mr-2 h-4 w-4" /> Karya saya
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href={KARYA_PATHS.student(student.username)} className="cursor-pointer">
						<ExternalLink className="mr-2 h-4 w-4" /> Profil publik
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href={`${KARYA_PATHS.dashboard}?tab=profil`} className="cursor-pointer">
						<UserRound className="mr-2 h-4 w-4" /> Edit profil
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href={`${KARYA_PATHS.dashboard}?tab=akun`} className="cursor-pointer">
						<ShieldCheck className="mr-2 h-4 w-4" /> Akun & keamanan
					</Link>
				</DropdownMenuItem>
				{buyer ? (
					<DropdownMenuItem asChild>
						<Link href={accountHref} className="cursor-pointer">
							<ShoppingBag className="mr-2 h-4 w-4" /> Akun toko (pembeli)
						</Link>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={logout} disabled={busy} className="cursor-pointer text-red-500 focus:text-red-500">
					<LogOut className="mr-2 h-4 w-4" /> Keluar akun mahasiswa
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
