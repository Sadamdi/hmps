import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
	getGuestIdentity,
	getOrCreateGuestSecret,
	saveGuestIdentity,
} from '@/lib/guest-identity';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import type { CommentItem, CommentTargetType } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	CornerDownRight,
	Edit2,
	Loader2,
	MessageSquare,
	Send,
	Trash2,
	X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface CommentThreadProps {
	targetType: CommentTargetType;
	targetId: string;
	mode?: 'public' | 'moderation';
	compact?: boolean;
}

function timeAgo(date: Date | string): string {
	const d = new Date(date);
	const now = new Date();
	const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
	if (diff < 60) return 'baru saja';
	if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
	if (diff < 2592000) return `${Math.floor(diff / 86400)} hari lalu`;
	return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildTree(comments: CommentItem[]): CommentItem[] {
	const map = new Map<string, CommentItem>();
	const roots: CommentItem[] = [];
	for (const c of comments) {
		map.set(c._id, { ...c, replies: [] });
	}
	for (const c of comments) {
		const node = map.get(c._id)!;
		if (c.parentId && map.has(c.parentId)) {
			map.get(c.parentId)!.replies!.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}

export default function CommentThread({
	targetType,
	targetId,
	mode = 'public',
	compact = false,
}: CommentThreadProps) {
	const queryKey = mode === 'moderation'
		? ['/api/comments/manage', targetType, targetId]
		: ['/api/comments', targetType, targetId];

	const { data: comments = [], isLoading } = useQuery<CommentItem[]>({
		queryKey,
		queryFn: async () => {
			const guest = getGuestIdentity();
			const headers: Record<string, string> = {};
			if (guest?.secret) headers['x-guest-key'] = guest.secret;

			const url = mode === 'moderation'
				? `/api/comments/manage?targetType=${targetType}&targetId=${targetId}`
				: `/api/comments?targetType=${targetType}&targetId=${targetId}`;

			const res = await fetch(url, { credentials: 'include', headers });
			if (!res.ok) throw new Error('Failed to fetch comments');
			return res.json();
		},
		staleTime: 30_000,
	});

	const tree = useMemo(() => buildTree(comments), [comments]);
	const totalCount = comments.length;

	return (
		<div className={compact ? 'space-y-3' : 'space-y-4 mt-8'}>
			{!compact && (
				<h2 className="text-lg font-semibold flex items-center gap-2">
					<MessageSquare className="h-5 w-5" />
					Komentar {totalCount > 0 && `(${totalCount})`}
				</h2>
			)}

			{mode === 'public' && (
				<CommentForm
					targetType={targetType}
					targetId={targetId}
					queryKey={queryKey}
				/>
			)}

			{isLoading ? (
				<div className="flex items-center justify-center py-8 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin mr-2" />
					Memuat komentar...
				</div>
			) : tree.length === 0 ? (
				<p className="text-center py-6 text-muted-foreground text-sm">
					Belum ada komentar. Jadilah yang pertama!
				</p>
			) : (
				<div className="space-y-3">
					{tree.map((c) => (
						<CommentNode
							key={c._id}
							comment={c}
							targetType={targetType}
							targetId={targetId}
							queryKey={queryKey}
							mode={mode}
							depth={0}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/* ─── Comment form ─── */

function CommentForm({
	targetType,
	targetId,
	parentId,
	queryKey,
	onCancel,
	autoFocus,
}: {
	targetType: CommentTargetType;
	targetId: string;
	parentId?: string;
	queryKey: (string | undefined)[];
	onCancel?: () => void;
	autoFocus?: boolean;
}) {
	const { user } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const guest = getGuestIdentity();
	const [body, setBody] = useState('');
	const [displayName, setDisplayName] = useState(guest?.displayName || '');
	const [isAnonymous, setIsAnonymous] = useState(false);

	const createMutation = useMutation({
		mutationFn: async () => {
			const payload: any = {
				targetType,
				targetId,
				body,
				isAnonymous,
				parentId: parentId || null,
			};
			if (user) {
				// logged-in
			} else {
				const secret = getOrCreateGuestSecret();
				payload.guestSecret = secret;
				if (!isAnonymous) {
					payload.displayName = displayName.trim();
					saveGuestIdentity(secret, displayName.trim());
				}
			}
			const res = await apiRequest('POST', '/api/comments', payload);
			return res.json();
		},
		onSuccess: () => {
			setBody('');
			queryClient.invalidateQueries({ queryKey });
			onCancel?.();
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal mengirim komentar',
				description: err.message || 'Terjadi kesalahan',
				variant: 'destructive',
			});
		},
	});

	const canSubmit = body.trim().length > 0 && (user || isAnonymous || displayName.trim().length > 0);

	return (
		<div className="space-y-2">
			{!user && !isAnonymous && (
				<Input
					placeholder="Nama Anda"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					className="max-w-xs"
				/>
			)}
			<Textarea
				placeholder={parentId ? 'Tulis balasan...' : 'Tulis komentar...'}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				rows={parentId ? 2 : 3}
				autoFocus={autoFocus}
				className="resize-none"
			/>
			<div className="flex items-center justify-between gap-2 flex-wrap">
				<label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
					<Checkbox
						checked={isAnonymous}
						onCheckedChange={(v) => setIsAnonymous(!!v)}
					/>
					Kirim sebagai Anonim
				</label>
				<div className="flex gap-2">
					{onCancel && (
						<Button variant="ghost" size="sm" onClick={onCancel}>
							<X className="h-4 w-4 mr-1" />
							Batal
						</Button>
					)}
					<Button
						size="sm"
						disabled={!canSubmit || createMutation.isPending}
						onClick={() => createMutation.mutate()}
					>
						{createMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin mr-1" />
						) : (
							<Send className="h-4 w-4 mr-1" />
						)}
						Kirim
					</Button>
				</div>
			</div>
		</div>
	);
}

/* ─── Single comment node ─── */

function CommentNode({
	comment,
	targetType,
	targetId,
	queryKey,
	mode,
	depth,
}: {
	comment: CommentItem;
	targetType: CommentTargetType;
	targetId: string;
	queryKey: (string | undefined)[];
	mode: 'public' | 'moderation';
	depth: number;
}) {
	const { user } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [replying, setReplying] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editBody, setEditBody] = useState(comment.body);

	const isModeratorMode = mode === 'moderation';

	const canEdit = !isModeratorMode && comment.isOwn;
	const canDelete = isModeratorMode || comment.isOwn;

	const editMutation = useMutation({
		mutationFn: async () => {
			const payload: any = { body: editBody };
			if (!user) {
				const guest = getGuestIdentity();
				if (guest?.secret) payload.guestSecret = guest.secret;
			}
			const res = await apiRequest('PATCH', `/api/comments/${comment._id}`, payload);
			return res.json();
		},
		onSuccess: () => {
			setEditing(false);
			queryClient.invalidateQueries({ queryKey });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal mengedit komentar',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async () => {
			const guest = getGuestIdentity();
			const headers: Record<string, string> = {};
			if (guest?.secret) headers['x-guest-key'] = guest.secret;
			await fetch(`/api/comments/${comment._id}`, {
				method: 'DELETE',
				credentials: 'include',
				headers,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			toast({ title: 'Komentar dihapus' });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal menghapus komentar',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	return (
		<div className={depth > 0 ? 'ml-6 border-l-2 border-muted pl-4' : ''}>
			<div className="rounded-lg border bg-card p-3 space-y-1.5">
				{/* Header */}
				<div className="flex items-center gap-2 text-sm">
					<span className="font-medium">
						{comment.isAnonymous ? 'Anonim' : comment.displayName}
					</span>
					<span className="text-muted-foreground text-xs">
						{timeAgo(comment.createdAt)}
					</span>
					{comment.editedAt && (
						<span className="text-muted-foreground text-xs italic">(diedit)</span>
					)}
				</div>

				{/* Body */}
				{editing ? (
					<div className="space-y-2">
						<Textarea
							value={editBody}
							onChange={(e) => setEditBody(e.target.value)}
							rows={2}
							autoFocus
							className="resize-none"
						/>
						<div className="flex gap-2 justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setEditing(false);
									setEditBody(comment.body);
								}}
							>
								Batal
							</Button>
							<Button
								size="sm"
								disabled={!editBody.trim() || editMutation.isPending}
								onClick={() => editMutation.mutate()}
							>
								{editMutation.isPending && (
									<Loader2 className="h-3 w-3 animate-spin mr-1" />
								)}
								Simpan
							</Button>
						</div>
					</div>
				) : (
					<p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
				)}

				{/* Actions */}
				{!editing && (
					<div className="flex gap-1 pt-0.5">
						{mode === 'public' && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setReplying(!replying)}
							>
								<CornerDownRight className="h-3 w-3 mr-1" />
								Balas
							</Button>
						)}
						{canEdit && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setEditing(true)}
							>
								<Edit2 className="h-3 w-3 mr-1" />
								Edit
							</Button>
						)}
						{canDelete && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs text-muted-foreground hover:text-destructive"
								onClick={() => {
									if (confirm('Hapus komentar ini?')) deleteMutation.mutate();
								}}
								disabled={deleteMutation.isPending}
							>
								{deleteMutation.isPending ? (
									<Loader2 className="h-3 w-3 animate-spin mr-1" />
								) : (
									<Trash2 className="h-3 w-3 mr-1" />
								)}
								Hapus
							</Button>
						)}
					</div>
				)}
			</div>

			{/* Reply form */}
			{replying && (
				<div className="ml-6 mt-2">
					<CommentForm
						targetType={targetType}
						targetId={targetId}
						parentId={comment._id}
						queryKey={queryKey}
						onCancel={() => setReplying(false)}
						autoFocus
					/>
				</div>
			)}

			{/* Child replies */}
			{comment.replies && comment.replies.length > 0 && (
				<div className="mt-2 space-y-2">
					{comment.replies.map((child) => (
						<CommentNode
							key={child._id}
							comment={child}
							targetType={targetType}
							targetId={targetId}
							queryKey={queryKey}
							mode={mode}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}
