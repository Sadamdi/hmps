import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	CheckCircle2,
	Eye,
	EyeOff,
	Image as ImageIcon,
	Loader2,
	MessageSquareReply,
	Star,
	Trash2,
	XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildSimpleSpyroPageData } from '@shared/dashboard-spyro-context';
import type { FeedbackItem } from '@shared/schema';

const TARGET_LABELS: Record<string, string> = {
	web: 'Website',
	himatif_encoder: 'Himatif Encoder',
	prodi_ti_umalang: 'Prodi TI UIN Malang',
};

const TYPE_LABELS: Record<string, string> = {
	saran: 'Saran',
	kritik: 'Kritik',
};

const STATUS_LABELS: Record<string, string> = {
	pending: 'Menunggu',
	accepted: 'Diterima',
	rejected: 'Ditolak',
};

function StarRating({ value }: { value: number }) {
	return (
		<span className="inline-flex items-center gap-0.5">
			{[1, 2, 3, 4, 5].map((i) => (
				<Star
					key={i}
					className={`h-3.5 w-3.5 ${i <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
				/>
			))}
			<span className="text-xs ml-1 text-muted-foreground">
				{value > 0 ? value.toFixed(1) : '-'}
			</span>
		</span>
	);
}

function SuggestionStatusBadge({ status }: { status: string }) {
	if (status === 'accepted') {
		return <Badge variant="outline" className="border-green-500/50 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Diterima</Badge>;
	}
	if (status === 'rejected') {
		return <Badge variant="outline" className="border-red-500/50 text-red-600"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
	}
	return <Badge variant="secondary">Menunggu</Badge>;
}

export default function FeedbackPage() {
	const { user, hasSpecificPermission } = useAuth();
	usePermissionRefresh();

	const { hasPermission, isLoading: isPermLoading } = usePermissionGuardAny([
		'feedback.view',
		'feedback.manage',
	]);

	const canManage = hasSpecificPermission('feedback.manage');
	const { toast } = useToast();

	const [filterTarget, setFilterTarget] = useState<string>('all');
	const [filterType, setFilterType] = useState<string>('all');
	const [filterReply, setFilterReply] = useState<string>('all');

	const [replyDialogOpen, setReplyDialogOpen] = useState(false);
	const [replyFeedbackId, setReplyFeedbackId] = useState<string | null>(null);
	const [replyMessage, setReplyMessage] = useState('');

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteFeedbackId, setDeleteFeedbackId] = useState<string | null>(null);

	const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
	const [decisionFeedbackId, setDecisionFeedbackId] = useState<string | null>(null);
	const [decisionAction, setDecisionAction] = useState<'accepted' | 'rejected'>('accepted');
	const [decisionComment, setDecisionComment] = useState('');

	const queryParams = new URLSearchParams();
	if (filterTarget !== 'all') queryParams.set('target', filterTarget);
	if (filterType !== 'all') queryParams.set('type', filterType);
	if (filterReply !== 'all') queryParams.set('hasReply', filterReply);

	const { data, isLoading } = useQuery<{ items: FeedbackItem[]; total: number }>({
		queryKey: ['/api/feedback/manage', filterTarget, filterType, filterReply],
		queryFn: async () => {
			const res = await fetch(`/api/feedback/manage?${queryParams.toString()}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Failed to fetch feedback');
			return res.json();
		},
		staleTime: 5000,
	});

	const { data: ratingData } = useQuery<{
		fasilitasTI: number;
		website: number;
		teknikInformatika: number;
		himatifEncoder: number;
		count: number;
	}>({
		queryKey: ['/api/feedback/manage/ratings'],
		staleTime: 30000,
	});

	const toggleVisibilityMut = useMutation({
		mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
			await apiRequest('PATCH', `/api/feedback/manage/${id}/visibility`, { visible });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			toast({ title: 'Visibility diperbarui' });
		},
		onError: () => toast({ title: 'Gagal', variant: 'destructive' }),
	});

	const replyMut = useMutation({
		mutationFn: async ({ id, message }: { id: string; message: string }) => {
			await apiRequest('POST', `/api/feedback/manage/${id}/reply`, { message });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			toast({ title: 'Balasan terkirim' });
			setReplyDialogOpen(false);
			setReplyMessage('');
		},
		onError: () => toast({ title: 'Gagal mengirim balasan', variant: 'destructive' }),
	});

	const deleteMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `/api/feedback/manage/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			toast({ title: 'Feedback dihapus' });
			setDeleteDialogOpen(false);
		},
		onError: () => toast({ title: 'Gagal menghapus', variant: 'destructive' }),
	});

	const decisionMut = useMutation({
		mutationFn: async ({ id, status, comment }: { id: string; status: 'accepted' | 'rejected'; comment: string }) => {
			await apiRequest('POST', `/api/feedback/manage/${id}/decision`, { status, comment });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			toast({ title: `Saran telah ${decisionAction === 'accepted' ? 'diterima' : 'ditolak'}` });
			setDecisionDialogOpen(false);
			setDecisionComment('');
		},
		onError: () => toast({ title: 'Gagal memproses keputusan', variant: 'destructive' }),
	});

	const feedbackPageDataForSpyro = useMemo(() => {
		if (!user || isPermLoading) {
			return buildSimpleSpyroPageData(
				'feedback',
				'feedback.permissions_loading',
				'Memuat izin atau sesi untuk moderasi saran & kritik.',
			);
		}
		const filterSummary = `sasaran:${filterTarget}, jenis:${filterType}, balasan:${filterReply}`;
		const dialogHint =
			replyDialogOpen || deleteDialogOpen || decisionDialogOpen
				? ' Dialog moderasi (balasan/hapus/keputusan) terbuka.'
				: '';
		return buildSimpleSpyroPageData(
			'feedback',
			'feedback.main',
			`Moderasi masukan pengunjung.${dialogHint} Filter aktif: ${filterSummary}.`,
			{ tab: `${filterTarget}/${filterType}/${filterReply}` },
		);
	}, [
		user,
		isPermLoading,
		filterTarget,
		filterType,
		filterReply,
		replyDialogOpen,
		deleteDialogOpen,
		decisionDialogOpen,
	]);

	if (!user || isPermLoading) {
		return (
			<DashboardLayout title="Saran & Kritik" pageContextExtra={{ pageData: feedbackPageDataForSpyro }}>
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div>
			</DashboardLayout>
		);
	}

	if (!hasPermission) return null;

	const items = data?.items ?? [];

	return (
		<DashboardLayout title="Saran & Kritik" pageContextExtra={{ pageData: feedbackPageDataForSpyro }}>
			<div className="space-y-6">
				<DashboardHintCard
					title="Cara memakai moderasi feedback"
					variant="blue"
					storageKey="dashboard-feedback"
					description="Feedback pengunjung masuk sebagai item dengan status. Moderasi (balasan, ubah status, sembunyikan) membutuhkan izin manage; tanpa itu hanya baca.">
					<ul className="list-disc list-inside space-y-1.5 text-sm">
						<li>
							<strong>Langkah</strong>: (1) pilih filter (semua / belum dibalas / peringkat, jika ada); (2) buka kartu masukan; (3) tulis <strong>balasan resmi</strong> jika perlu; (4) ubah status (mis. diterima, ditolak, selesai) sesuai UI; (5) simpan.
						</li>
						<li>
							<strong>Contoh valid</strong>: balasan singkat sopan: <code className="text-xs bg-muted px-1 rounded">Terima kasih, kami akan bahas di rapat bulan ini.</code>; status disetel konsisten dengan tindakan panitia.
						</li>
						<li>
							<strong>Contoh tidak valid / ditolak</strong>: mengirim balasan kosong jika server mewajibkan teks; aksi moderasi tanpa <code className="text-xs bg-muted px-1 rounded">feedback.manage</code> (403).
						</li>
						<li>
							<strong>Jika gagal</strong>: refresh dan coba lagi; pastikan tidak ada duplikasi klik; cek apakah feedback sudah dihapus pengguna.
						</li>
						<li>
							<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">feedback.view</code> untuk melihat daftar; <code className="text-xs bg-muted px-1 rounded">feedback.manage</code> untuk membalas dan mengubah status.
						</li>
					</ul>
				</DashboardHintCard>

				{/* Rating Summary */}
				{ratingData && ratingData.count > 0 && (
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>Fasilitas TI</CardDescription>
							</CardHeader>
							<CardContent>
								<StarRating value={ratingData.fasilitasTI} />
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>Website</CardDescription>
							</CardHeader>
							<CardContent>
								<StarRating value={ratingData.website} />
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>Teknik Informatika</CardDescription>
							</CardHeader>
							<CardContent>
								<StarRating value={ratingData.teknikInformatika} />
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>Himatif Encoder</CardDescription>
							</CardHeader>
							<CardContent>
								<StarRating value={ratingData.himatifEncoder} />
							</CardContent>
						</Card>
					</div>
				)}

				{/* Filters */}
				<Card>
					<CardHeader>
						<CardTitle>Filter</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-4">
							<div className="w-48">
								<Label className="text-xs mb-1 block">Tujuan</Label>
								<Select value={filterTarget} onValueChange={setFilterTarget}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Semua</SelectItem>
										<SelectItem value="web">Website</SelectItem>
										<SelectItem value="himatif_encoder">Himatif Encoder</SelectItem>
										<SelectItem value="prodi_ti_umalang">Prodi TI</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="w-40">
								<Label className="text-xs mb-1 block">Jenis</Label>
								<Select value={filterType} onValueChange={setFilterType}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Semua</SelectItem>
										<SelectItem value="saran">Saran</SelectItem>
										<SelectItem value="kritik">Kritik</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="w-40">
								<Label className="text-xs mb-1 block">Status Balasan</Label>
								<Select value={filterReply} onValueChange={setFilterReply}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Semua</SelectItem>
										<SelectItem value="false">Belum dibalas</SelectItem>
										<SelectItem value="true">Sudah dibalas</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Feedback List */}
				<Card>
					<CardHeader>
						<CardTitle>Daftar Feedback ({data?.total ?? 0})</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin" />
							</div>
						) : items.length === 0 ? (
							<p className="text-center py-8 text-muted-foreground">Belum ada feedback</p>
						) : (
							<div className="space-y-4">
								{items.map((fb) => (
									<div
										key={fb._id}
										className="border rounded-lg p-4 space-y-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex items-center gap-2 flex-wrap">
												<Badge variant={fb.type === 'kritik' ? 'destructive' : 'default'}>
													{TYPE_LABELS[fb.type]}
												</Badge>
												<Badge variant="outline">
													{TARGET_LABELS[fb.target]}
												</Badge>
												{fb.isAnonymous && (
													<Badge variant="secondary">Anonim</Badge>
												)}
												{fb.reply && (
													<Badge variant="outline" className="border-green-500/50 text-green-600">
														Sudah dibalas
													</Badge>
												)}
												{fb.type === 'saran' && (
													<SuggestionStatusBadge status={fb.suggestionStatus || 'pending'} />
												)}
											</div>
											<span className="text-xs text-muted-foreground whitespace-nowrap">
												{new Date(fb.createdAt).toLocaleDateString('id-ID', {
													day: 'numeric',
													month: 'short',
													year: 'numeric',
													hour: '2-digit',
													minute: '2-digit',
												})}
											</span>
										</div>

										{!fb.isAnonymous && (
											<div className="text-sm text-muted-foreground">
												<span className="font-medium text-foreground">{fb.senderName}</span>
												{fb.senderNim && <span> &middot; {fb.senderNim}</span>}
												{fb.senderEmail && <span> &middot; {fb.senderEmail}</span>}
											</div>
										)}

										<p className="text-sm whitespace-pre-wrap">{fb.body}</p>

										{Array.isArray(fb.media) && fb.media.length > 0 && (
											<div className="space-y-2">
												<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
													<ImageIcon className="h-3.5 w-3.5" />
													<span>Lampiran ({fb.media.length})</span>
												</div>
												<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
													{fb.media.map((m, idx) => (
														<a
															key={`${fb._id}-media-${idx}`}
															href={m.url}
															target="_blank"
															rel="noopener noreferrer"
															className="group relative block rounded-md border overflow-hidden bg-muted/20"
															title={m.originalName || `attachment-${idx + 1}`}
														>
															<img
																src={m.url}
																alt={m.originalName || `Attachment ${idx + 1}`}
																loading="lazy"
																className="h-24 w-full object-cover transition-transform group-hover:scale-[1.03]"
															/>
															<div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-[10px] text-white truncate">
																{m.originalName || `attachment-${idx + 1}`}
															</div>
														</a>
													))}
												</div>
											</div>
										)}

										{/* Individual ratings */}
										{(fb.ratings.fasilitasTI > 0 || fb.ratings.website > 0 || fb.ratings.teknikInformatika > 0 || fb.ratings.himatifEncoder > 0) && (
											<div className="flex flex-wrap gap-4 text-xs">
												{fb.ratings.fasilitasTI > 0 && (
													<span>Fasilitas TI: <StarRating value={fb.ratings.fasilitasTI} /></span>
												)}
												{fb.ratings.website > 0 && (
													<span>Website: <StarRating value={fb.ratings.website} /></span>
												)}
												{fb.ratings.teknikInformatika > 0 && (
													<span>TI: <StarRating value={fb.ratings.teknikInformatika} /></span>
												)}
												{fb.ratings.himatifEncoder > 0 && (
													<span>Himatif: <StarRating value={fb.ratings.himatifEncoder} /></span>
												)}
											</div>
										)}

										{/* Suggestion decision history */}
										{fb.type === 'saran' && fb.suggestionStatus !== 'pending' && fb.suggestionDecidedAt && (
											<div className={`rounded-lg p-3 border-l-2 ${fb.suggestionStatus === 'accepted' ? 'bg-green-50 dark:bg-green-500/10 border-green-500' : 'bg-red-50 dark:bg-red-500/10 border-red-500'}`}>
												<p className="text-xs text-muted-foreground mb-1">
													{STATUS_LABELS[fb.suggestionStatus]} oleh <span className="font-medium">{fb.suggestionDeciderName}</span>
													{' '}&middot;{' '}
													{new Date(fb.suggestionDecidedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
												</p>
												{fb.suggestionDecisionComment && (
													<p className="text-sm whitespace-pre-wrap">{fb.suggestionDecisionComment}</p>
												)}
											</div>
										)}

										{fb.reply && (
											<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
												<p className="text-xs text-muted-foreground mb-1">
													Balasan dari <span className="font-medium">{fb.reply.adminName}</span>
													{' '}&middot;{' '}
													{new Date(fb.reply.repliedAt).toLocaleDateString('id-ID', {
														day: 'numeric',
														month: 'short',
														year: 'numeric',
													})}
												</p>
												<p className="text-sm whitespace-pre-wrap">{fb.reply.message}</p>
											</div>
										)}

										{canManage && (
											<div className="flex items-center gap-2 pt-1 flex-wrap">
												<div className="flex items-center gap-2">
													<Switch
														checked={fb.isVisibleCard}
														onCheckedChange={(checked) =>
															toggleVisibilityMut.mutate({ id: fb._id, visible: checked })
														}
													/>
													<Label className="text-xs flex items-center gap-1">
														{fb.isVisibleCard ? (
															<><Eye className="h-3.5 w-3.5" /> Tampil</>
														) : (
															<><EyeOff className="h-3.5 w-3.5" /> Tersembunyi</>
														)}
													</Label>
												</div>
												{!fb.reply && (
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															setReplyFeedbackId(fb._id);
															setReplyMessage('');
															setReplyDialogOpen(true);
														}}
													>
														<MessageSquareReply className="h-4 w-4 mr-1" />
														Balas
													</Button>
												)}
												{fb.type === 'saran' && fb.suggestionStatus === 'pending' && (
													<>
														<Button
															variant="outline"
															size="sm"
															className="border-green-500/50 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
															onClick={() => {
																setDecisionFeedbackId(fb._id);
																setDecisionAction('accepted');
																setDecisionComment('');
																setDecisionDialogOpen(true);
															}}
														>
															<CheckCircle2 className="h-4 w-4 mr-1" />
															Accept
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="border-red-500/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
															onClick={() => {
																setDecisionFeedbackId(fb._id);
																setDecisionAction('rejected');
																setDecisionComment('');
																setDecisionDialogOpen(true);
															}}
														>
															<XCircle className="h-4 w-4 mr-1" />
															Reject
														</Button>
													</>
												)}
												<Button
													variant="destructive"
													size="sm"
													onClick={() => {
														setDeleteFeedbackId(fb._id);
														setDeleteDialogOpen(true);
													}}
												>
													<Trash2 className="h-4 w-4 mr-1" />
													Hapus
												</Button>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Reply Dialog */}
			<Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Balas Feedback</DialogTitle>
					</DialogHeader>
					<Textarea
						placeholder="Tulis balasan..."
						value={replyMessage}
						onChange={(e) => setReplyMessage(e.target.value)}
						rows={4}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
							Batal
						</Button>
						<Button
							disabled={!replyMessage.trim() || replyMut.isPending}
							onClick={() => {
								if (replyFeedbackId) {
									replyMut.mutate({ id: replyFeedbackId, message: replyMessage });
								}
							}}
						>
							{replyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Kirim Balasan
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Decision Dialog */}
			<Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{decisionAction === 'accepted' ? 'Terima Saran' : 'Tolak Saran'}
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						{decisionAction === 'accepted'
							? 'Saran ini akan ditandai sebagai diterima. Pengirim non-anonim akan menerima email pemberitahuan.'
							: 'Saran ini akan ditandai sebagai ditolak. Pengirim non-anonim akan menerima email pemberitahuan.'}
					</p>
					<Textarea
						placeholder="Komentar keputusan (opsional)..."
						value={decisionComment}
						onChange={(e) => setDecisionComment(e.target.value)}
						rows={3}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
							Batal
						</Button>
						<Button
							variant={decisionAction === 'accepted' ? 'default' : 'destructive'}
							disabled={decisionMut.isPending}
							onClick={() => {
								if (decisionFeedbackId) {
									decisionMut.mutate({
										id: decisionFeedbackId,
										status: decisionAction,
										comment: decisionComment,
									});
								}
							}}
						>
							{decisionMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							{decisionAction === 'accepted' ? 'Terima' : 'Tolak'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirm Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Hapus Feedback</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						Apakah Anda yakin ingin menghapus feedback ini? Tindakan ini tidak bisa dibatalkan.
					</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
							Batal
						</Button>
						<Button
							variant="destructive"
							disabled={deleteMut.isPending}
							onClick={() => {
								if (deleteFeedbackId) {
									deleteMut.mutate(deleteFeedbackId);
								}
							}}
						>
							{deleteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Hapus
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
