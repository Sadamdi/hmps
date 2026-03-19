import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Check,
	Crown,
	Eye,
	Loader2,
	Pencil,
	Search,
	Share2,
	Trash2,
	UserPlus,
	X,
} from 'lucide-react';
import { useState } from 'react';
import type { SharingEntityType, SharingPermission } from '@shared/schema';

interface SharingPanelProps {
	entityType: SharingEntityType;
	entityId: string;
	entityTitle: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function SharingPanel({
	entityType,
	entityId,
	entityTitle,
	open,
	onOpenChange,
}: SharingPanelProps) {
	const { user } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [searchQuery, setSearchQuery] = useState('');
	const [invitePermission, setInvitePermission] =
		useState<SharingPermission>('view');
	const [requestPermission, setRequestPermission] =
		useState<SharingPermission>('view');

	const sharingKey = ['/api/sharing', entityType, entityId];

	const { data: sharingData, isLoading } = useQuery({
		queryKey: sharingKey,
		queryFn: async () => {
			const res = await fetch(`/api/sharing/${entityType}/${entityId}`, {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed to fetch sharing info');
			return res.json();
		},
		enabled: open && !!entityId,
		staleTime: 10000,
	});

	const { data: searchResults = [] } = useQuery({
		queryKey: ['/api/sharing/users/search', searchQuery],
		queryFn: async () => {
			if (!searchQuery || searchQuery.length < 2) return [];
			const res = await fetch(
				`/api/sharing/users/search?q=${encodeURIComponent(searchQuery)}`,
				{ credentials: 'include' },
			);
			if (!res.ok) return [];
			return res.json();
		},
		enabled: searchQuery.length >= 2,
		staleTime: 5000,
	});

	const inviteMutation = useMutation({
		mutationFn: async ({
			targetUserId,
			permission,
		}: {
			targetUserId: string;
			permission: SharingPermission;
		}) => {
			const res = await fetch(
				`/api/sharing/${entityType}/${entityId}/invite`,
				{
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ targetUserId, permission }),
				},
			);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed to send invite');
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sharingKey });
			queryClient.invalidateQueries({ queryKey: ['/api/sharing/my-summary'] });
			queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			setSearchQuery('');
			toast({ title: 'Undangan terkirim' });
		},
		onError: (err: Error) => {
			toast({
				title: 'Gagal',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	const requestMutation = useMutation({
		mutationFn: async (permission: SharingPermission) => {
			const res = await fetch(
				`/api/sharing/${entityType}/${entityId}/request`,
				{
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ permission }),
				},
			);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed to send request');
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sharingKey });
			queryClient.invalidateQueries({ queryKey: ['/api/sharing/my-summary'] });
			queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			toast({ title: 'Permintaan terkirim' });
		},
		onError: (err: Error) => {
			toast({
				title: 'Gagal',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	const decisionMutation = useMutation({
		mutationFn: async ({
			sharingId,
			decision,
		}: {
			sharingId: string;
			decision: 'approve' | 'decline';
		}) => {
			const res = await fetch(`/api/sharing/decision/${sharingId}`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decision }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed');
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sharingKey });
			queryClient.invalidateQueries({ queryKey: ['/api/sharing/my-summary'] });
			queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			queryClient.invalidateQueries({
				queryKey: ['/api/sharing/notifications'],
			});
			toast({ title: 'Berhasil' });
		},
		onError: (err: Error) => {
			toast({
				title: 'Gagal',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	const revokeMutation = useMutation({
		mutationFn: async (revokeUserId: string) => {
			const res = await fetch(
				`/api/sharing/${entityType}/${entityId}/access/${revokeUserId}`,
				{ method: 'DELETE', credentials: 'include' },
			);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed');
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sharingKey });
			queryClient.invalidateQueries({ queryKey: ['/api/sharing/my-summary'] });
			queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			toast({ title: 'Akses dicabut' });
		},
		onError: (err: Error) => {
			toast({
				title: 'Gagal',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	const isOwner = sharingData?.isOwner === true;
	const approved = sharingData?.approved || [];
	const pending = sharingData?.pending || [];
	const owners = sharingData?.owners || [];

	const filteredUsers = searchResults.filter(
		(u: any) =>
			u._id !== user?._id &&
			!owners.some((o: any) => o._id === u._id) &&
			!approved.some(
				(a: any) =>
					(typeof a.targetId === 'object'
						? a.targetId._id
						: a.targetId) === u._id,
			),
	);

	const entityLabel =
		entityType === 'berita'
			? 'Berita'
			: entityType === 'events'
				? 'Event'
				: 'Galeri';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100vw-1rem)] max-w-[680px] max-h-[90dvh] p-0 overflow-hidden">
				<DialogHeader className="px-4 sm:px-5 pt-4 pb-3 border-b">
					<DialogTitle className="flex items-center gap-2">
						<Share2 className="h-5 w-5" />
						Manajemen Akses - {entityLabel}
					</DialogTitle>
					<p className="text-sm text-muted-foreground whitespace-normal break-words leading-snug">
						{entityTitle}
					</p>
				</DialogHeader>

				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : (
					<div className="space-y-6 px-4 sm:px-5 py-4 overflow-y-auto max-h-[calc(90dvh-88px)]">
						{/* Owners */}
						<div>
							<Label className="text-xs uppercase tracking-wider text-muted-foreground">
								Owner
							</Label>
							<div className="mt-2 space-y-1">
								{owners.map((o: any) => (
									<div
										key={o._id}
										className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 min-w-0">
										<Crown className="h-4 w-4 text-amber-500" />
										<span className="text-sm font-medium min-w-0 break-words">
											{o.name}
										</span>
										<span className="text-xs text-muted-foreground min-w-0 break-words">
											@{o.username}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Invite (Owner only) */}
						{isOwner && (
							<div className="space-y-3">
								<Label className="text-xs uppercase tracking-wider text-muted-foreground">
									Undang User
								</Label>
								<div className="flex gap-2">
									<div className="relative flex-1">
										<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="Cari nama atau username..."
											className="pl-8 h-9"
											value={searchQuery}
											onChange={(e) =>
												setSearchQuery(e.target.value)
											}
										/>
									</div>
									<Select
										value={invitePermission}
										onValueChange={(v) =>
											setInvitePermission(
												v as SharingPermission,
											)
										}>
										<SelectTrigger className="w-24 h-9">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="view">
												View
											</SelectItem>
											<SelectItem value="edit">
												Edit
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{filteredUsers.length > 0 && (
									<div className="border rounded-md max-h-40 overflow-y-auto">
										{filteredUsers.map((u: any) => (
											<button
												key={u._id}
												className="w-full flex items-center justify-between p-2 hover:bg-secondary/50 text-left text-sm"
												onClick={() =>
													inviteMutation.mutate({
														targetUserId: u._id,
														permission:
															invitePermission,
													})
												}
												disabled={
													inviteMutation.isPending
												}>
												<div>
													<span className="font-medium">
														{u.name}
													</span>
													<span className="text-muted-foreground ml-1">
														@{u.username}
													</span>
												</div>
												<UserPlus className="h-4 w-4 text-primary" />
											</button>
										))}
									</div>
								)}
							</div>
						)}

						{/* Request (Non-owner) */}
						{!isOwner && (
							<div className="space-y-3">
								<Label className="text-xs uppercase tracking-wider text-muted-foreground">
									Minta Akses
								</Label>
								<div className="flex gap-2">
									<Select
										value={requestPermission}
										onValueChange={(v) =>
											setRequestPermission(
												v as SharingPermission,
											)
										}>
										<SelectTrigger className="flex-1 h-9">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="view">
												View (lihat saja)
											</SelectItem>
											<SelectItem value="edit">
												Edit (edit & delete)
											</SelectItem>
										</SelectContent>
									</Select>
									<Button
										size="sm"
										onClick={() =>
											requestMutation.mutate(
												requestPermission,
											)
										}
										disabled={requestMutation.isPending}>
										{requestMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											'Kirim'
										)}
									</Button>
								</div>
							</div>
						)}

						{/* Pending */}
						{pending.length > 0 && (
							<div>
								<Label className="text-xs uppercase tracking-wider text-muted-foreground">
									Menunggu Konfirmasi
								</Label>
								<div className="mt-2 space-y-2">
									{pending.map((p: any) => {
										const targetName =
											typeof p.targetId === 'object'
												? p.targetId.name
												: '';
										const requesterName =
											typeof p.requesterId === 'object'
												? p.requesterId.name
												: '';
										const targetUserId =
											typeof p.targetId === 'object'
												? p.targetId._id
												: p.targetId;
										const requesterUserId =
											typeof p.requesterId === 'object'
												? p.requesterId._id
												: p.requesterId;

										const canDecide =
											(p.kind === 'invite' &&
												targetUserId ===
													user?._id) ||
											(p.kind === 'request' && isOwner);

										return (
											<div
												key={p._id}
												className="flex items-center justify-between p-2 rounded-md border border-dashed">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-1.5">
														<Badge
															variant="outline"
															className="text-xs">
															{p.kind === 'invite'
																? 'Undangan'
																: 'Permintaan'}
														</Badge>
														<Badge
															variant="secondary"
															className="text-xs gap-0.5">
															{p.permission ===
															'edit' ? (
																<Pencil className="h-3 w-3" />
															) : (
																<Eye className="h-3 w-3" />
															)}
															{p.permission}
														</Badge>
													</div>
													<p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words">
														{p.kind === 'invite'
															? `Ke: ${targetName}`
															: `Dari: ${requesterName}`}
													</p>
												</div>
												{canDecide && (
													<div className="flex gap-1 ml-2">
														<Button
															size="icon"
															variant="ghost"
															className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
															onClick={() =>
																decisionMutation.mutate(
																	{
																		sharingId:
																			p._id,
																		decision:
																			'approve',
																	},
																)
															}
															disabled={
																decisionMutation.isPending
															}>
															<Check className="h-4 w-4" />
														</Button>
														<Button
															size="icon"
															variant="ghost"
															className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
															onClick={() =>
																decisionMutation.mutate(
																	{
																		sharingId:
																			p._id,
																		decision:
																			'decline',
																	},
																)
															}
															disabled={
																decisionMutation.isPending
															}>
															<X className="h-4 w-4" />
														</Button>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Granted */}
						{approved.length > 0 && (
							<div>
								<Label className="text-xs uppercase tracking-wider text-muted-foreground">
									Akses Diberikan
								</Label>
								<div className="mt-2 space-y-2">
									{approved.map((a: any) => {
										const targetName =
											typeof a.targetId === 'object'
												? a.targetId.name
												: '';
										const targetUsername =
											typeof a.targetId === 'object'
												? a.targetId.username
												: '';
										const targetUserId =
											typeof a.targetId === 'object'
												? a.targetId._id
												: a.targetId;

										const canRevoke =
											isOwner ||
											targetUserId === user?._id;

										return (
											<div
												key={a._id}
												className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/30">
												<div className="flex items-center gap-2 min-w-0">
													<Badge
														variant="secondary"
														className="text-xs gap-0.5">
														{a.permission ===
														'edit' ? (
															<Pencil className="h-3 w-3" />
														) : (
															<Eye className="h-3 w-3" />
														)}
														{a.permission}
													</Badge>
													<span className="text-sm font-medium whitespace-normal break-words">
														{targetName}
													</span>
													<span className="text-xs text-muted-foreground whitespace-normal break-words">
														@{targetUsername}
													</span>
												</div>
												{canRevoke && (
													<Button
														size="icon"
														variant="ghost"
														className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
														onClick={() =>
															revokeMutation.mutate(
																targetUserId,
															)
														}
														disabled={
															revokeMutation.isPending
														}>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}

						{approved.length === 0 && pending.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-4">
								Belum ada sharing untuk{' '}
								{entityLabel.toLowerCase()} ini.
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
