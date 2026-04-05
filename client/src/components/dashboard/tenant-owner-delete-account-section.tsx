import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'otp' | 'final' | 'countdown';

const COUNTDOWN_SECONDS = 10;

/**
 * Owner tenant: hapus komunitas + database tenant (termasuk akun owner di DB komunitas) dengan OTP email,
 * konfirmasi kedua, dan penghitungan mundur sebelum DELETE.
 */
export function TenantOwnerDeleteAccountSection() {
	const { user } = useAuth();
	const { isTenant } = useTenant();
	const { toast } = useToast();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [phase, setPhase] = useState<Phase>('idle');
	const [loading, setLoading] = useState(false);
	const [challengeId, setChallengeId] = useState('');
	const [resetToken, setResetToken] = useState('');
	const [otpValue, setOtpValue] = useState('');
	const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

	const credsRef = useRef({ challengeId: '', resetToken: '' });
	const deleteStartedRef = useRef(false);

	useEffect(() => {
		credsRef.current = { challengeId, resetToken };
	}, [challengeId, resetToken]);

	const resetFlow = useCallback(() => {
		setPhase('idle');
		setChallengeId('');
		setResetToken('');
		setOtpValue('');
		setCountdown(COUNTDOWN_SECONDS);
		deleteStartedRef.current = false;
	}, []);

	const handleDialogOpenChange = (open: boolean) => {
		setDialogOpen(open);
		if (!open) resetFlow();
	};

	const openDialog = () => {
		resetFlow();
		setDialogOpen(true);
	};

	const requestOtp = async () => {
		setLoading(true);
		try {
			const res = await apiRequest('POST', '/api/community/request-delete-otp', {});
			const data = await res.json();
			setChallengeId(data.challengeId);
			setPhase('otp');
			toast({ title: 'OTP terkirim', description: data.message || 'Periksa email Anda.' });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Gagal meminta OTP';
			toast({ title: 'Gagal', description: msg, variant: 'destructive' });
		} finally {
			setLoading(false);
		}
	};

	const verifyOtp = async () => {
		if (!challengeId || otpValue.length < 6) {
			toast({
				title: 'OTP diperlukan',
				description: 'Masukkan 6 digit kode dari email.',
				variant: 'destructive',
			});
			return;
		}
		setLoading(true);
		try {
			const v = await apiRequest('POST', '/api/community/verify-delete-otp', {
				challengeId,
				otp: otpValue.trim(),
			});
			const data = await v.json();
			setResetToken(data.resetToken);
			setPhase('final');
			toast({
				title: 'OTP benar',
				description: 'Konfirmasi langkah terakhir untuk melanjutkan.',
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'OTP tidak valid';
			toast({ title: 'Gagal', description: msg, variant: 'destructive' });
		} finally {
			setLoading(false);
		}
	};

	const startCountdown = () => {
		deleteStartedRef.current = false;
		setCountdown(COUNTDOWN_SECONDS);
		setPhase('countdown');
	};

	const executeDelete = useCallback(async () => {
		if (deleteStartedRef.current) return;
		const { challengeId: c, resetToken: r } = credsRef.current;
		if (!c || !r) {
			toast({
				title: 'Sesi tidak valid',
				description: 'Ulangi proses dari awal.',
				variant: 'destructive',
			});
			return;
		}
		deleteStartedRef.current = true;
		setLoading(true);
		try {
			await apiRequest('DELETE', '/api/community', {
				challengeId: c,
				resetToken: r,
			});
			toast({
				title: 'Komunitas dihapus',
				description: 'Mengalihkan ke beranda…',
			});
			setDialogOpen(false);
			window.location.href = '/';
		} catch (e: unknown) {
			deleteStartedRef.current = false;
			setPhase('final');
			setCountdown(COUNTDOWN_SECONDS);
			const msg = e instanceof Error ? e.message : 'Gagal menghapus';
			toast({ title: 'Gagal', description: msg, variant: 'destructive' });
		} finally {
			setLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		if (phase !== 'countdown') return;
		if (countdown === 0) return;
		const id = window.setTimeout(() => {
			setCountdown((c) => {
				if (c <= 1) {
					queueMicrotask(() => void executeDelete());
					return 0;
				}
				return c - 1;
			});
		}, 1000);
		return () => clearTimeout(id);
	}, [phase, countdown, executeDelete]);

	if (!isTenant || user?.role !== 'owner') return null;

	return (
		<>
			<Card className="border-destructive/40 bg-destructive/5">
				<CardHeader>
					<CardTitle className="text-destructive flex items-center gap-2">
						<Trash2 className="h-5 w-5 shrink-0" />
						Zona berbahaya
					</CardTitle>
					<CardDescription>
						Hapus akun owner beserta komunitas ini. Database komunitas akan di-drop (termasuk data akun
						owner di dalamnya), folder unggahan komunitas dibersihkan, dan entri komunitas di basis data
						utama dihapus. Butuh OTP ke email owner, konfirmasi kedua, lalu penghitungan mundur{' '}
						{COUNTDOWN_SECONDS} detik sebelum penghapusan final.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button type="button" variant="destructive" onClick={openDialog}>
						Hapus akun owner &amp; komunitas
					</Button>
				</CardContent>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
				<DialogContent
					className="sm:max-w-md"
					hideCloseButton={phase === 'countdown'}
					onPointerDownOutside={(e) => {
						if (phase === 'countdown') e.preventDefault();
					}}
					onEscapeKeyDown={(e) => {
						if (phase === 'countdown') e.preventDefault();
					}}>
					<DialogHeader>
						<DialogTitle>
							{phase === 'idle' && 'Hapus akun & komunitas?'}
							{phase === 'otp' && 'Masukkan kode OTP'}
							{phase === 'final' && 'Konfirmasi terakhir'}
							{phase === 'countdown' && 'Menghapus…'}
						</DialogTitle>
						<DialogDescription className="text-left space-y-2">
							{phase === 'idle' && (
								<>
									Anda akan menghapus <strong>seluruh data komunitas</strong> (termasuk akun owner di
									database komunitas) dan <strong>pendaftaran komunitas</strong> di sistem. OTP akan
									dikirim ke email owner.
								</>
							)}
							{phase === 'otp' && (
								<>Masukkan 6 digit kode dari email. Kode berlaku terbatas waktu.</>
							)}
							{phase === 'final' && (
								<>
									OTP sudah benar. Setelah Anda melanjutkan, penghitungan mundur {COUNTDOWN_SECONDS}{' '}
									detik dimulai sebelum penghapusan permanen. Anda bisa membatalkan selama
									penghitungan berjalan.
								</>
							)}
							{phase === 'countdown' && (
								<span className="block text-lg font-semibold text-destructive tabular-nums">
									Penghapusan dalam {countdown} detik…
								</span>
							)}
						</DialogDescription>
					</DialogHeader>

					{phase === 'otp' && (
						<div className="space-y-2 py-2">
							<Label>Kode OTP</Label>
							<div className="flex justify-center">
								<InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
									<InputOTPGroup>
										<InputOTPSlot index={0} />
										<InputOTPSlot index={1} />
										<InputOTPSlot index={2} />
										<InputOTPSlot index={3} />
										<InputOTPSlot index={4} />
										<InputOTPSlot index={5} />
									</InputOTPGroup>
								</InputOTP>
							</div>
						</div>
					)}

					<DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
						{phase === 'countdown' ? (
							<Button
								type="button"
								variant="outline"
								className="w-full sm:w-auto"
								disabled={loading}
								onClick={() => handleDialogOpenChange(false)}>
								Batalkan penghapusan
							</Button>
						) : (
							<>
								<Button
									type="button"
									variant="outline"
									onClick={() => handleDialogOpenChange(false)}
									disabled={loading}>
									Batal
								</Button>
								{phase === 'idle' && (
									<Button
										type="button"
										variant="destructive"
										onClick={() => void requestOtp()}
										disabled={loading}>
										{loading ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : null}
										Kirim OTP
									</Button>
								)}
								{phase === 'otp' && (
									<Button
										type="button"
										variant="destructive"
										onClick={() => void verifyOtp()}
										disabled={loading || otpValue.length < 6}>
										{loading ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : null}
										Verifikasi OTP
									</Button>
								)}
								{phase === 'final' && (
									<Button
										type="button"
										variant="destructive"
										onClick={startCountdown}
										disabled={loading}>
										Konfirmasi &amp; mulai {COUNTDOWN_SECONDS} dtk
									</Button>
								)}
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
