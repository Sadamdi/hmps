import { ConfirmDeleteAlertDialog } from '@/components/dashboard/confirm-delete-alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { CommentItem, CommentTargetType } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ChevronDown,
	ChevronUp,
	CornerDownRight,
	Loader2,
	MessageSquare,
	Send,
	Trash2,
	X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface CommentPanelProps {
	targetType: CommentTargetType;
	targetId: string;
}

function timeAgo(date: Date | string): string {
	const d = new Date(date);
	const now = new Date();
	const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
	if (diff < 60) return 'baru saja';
	if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
	if (diff < 2592000) return `${Math.floor(diff / 86400)}h lalu`;
	return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildTree(comments: CommentItem[]): CommentItem[] {
	const map = new Map<string, CommentItem>();
	const roots: CommentItem[] = [];
	for (const c of comments) map.set(c._id, { ...c, replies: [] });
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

export default function CommentPanel({ targetType, targetId }: CommentPanelProps) {
	const [expanded, setExpanded] = useState(false);
	const queryKey = ['/api/comments/manage', targetType, targetId];

	const { data: comments = [], isLoading } = useQuery<CommentItem[]>({
		queryKey,
		queryFn: async () => {
			const res = await fetch(
				`/api/comments/manage?targetType=${targetType}&targetId=${targetId}`,
				{ credentials: 'include' },
			);
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		enabled: expanded,
		staleTime: 30_000,
	});

	const tree = useMemo(() => buildTree(comments), [comments]);

	return (
		<div className="mt-2">
			<Button
				variant="ghost"
				size="sm"
				className="h-7 text-xs gap-1"
				onClick={() => setExpanded(!expanded)}
			>
				<MessageSquare className="h-3 w-3" />
				Komentar
				{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
			</Button>

			{expanded && (
				<div className="mt-2 border rounded-lg p-3 bg-muted/30 space-y-2">
					<ReplyForm targetType={targetType} targetId={targetId} queryKey={queryKey} />

					{isLoading ? (
						<div className="flex justify-center py-4">
							<Loader2 className="h-4 w-4 animate-spin" />
						</div>
					) : tree.length === 0 ? (
						<p className="text-center py-3 text-xs text-muted-foreground">Belum ada komentar.</p>
					) : (
						<div className="space-y-2 max-h-80 overflow-y-auto">
							{tree.map((c) => (
								<ModerationNode key={c._id} comment={c} queryKey={queryKey} targetType={targetType} targetId={targetId} depth={0} />
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function ReplyForm({
	targetType,
	targetId,
	parentId,
	queryKey,
	onCancel,
}: {
	targetType: CommentTargetType;
	targetId: string;
	parentId?: string;
	queryKey: (string | undefined)[];
	onCancel?: () => void;
}) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [body, setBody] = useState('');

	const mutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest('POST', '/api/comments', {
				targetType,
				targetId,
				body,
				parentId: parentId || null,
			});
			return res.json();
		},
		onSuccess: () => {
			setBody('');
			queryClient.invalidateQueries({ queryKey });
			onCancel?.();
		},
		onError: (err: any) => {
			toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
		},
	});

	return (
		<div className="flex gap-2">
			<Textarea
				placeholder={parentId ? 'Balas komentar...' : 'Tulis komentar sebagai admin...'}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				rows={1}
				className="resize-none min-h-[36px] text-sm flex-1"
			/>
			<div className="flex flex-col gap-1">
				<Button
					size="sm"
					className="h-9"
					disabled={!body.trim() || mutation.isPending}
					onClick={() => mutation.mutate()}
				>
					{mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
				</Button>
				{onCancel && (
					<Button variant="ghost" size="sm" className="h-6" onClick={onCancel}>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>
		</div>
	);
}

function ModerationNode({
	comment,
	queryKey,
	targetType,
	targetId,
	depth,
}: {
	comment: CommentItem;
	queryKey: (string | undefined)[];
	targetType: CommentTargetType;
	targetId: string;
	depth: number;
}) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [replying, setReplying] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const deleteMut = useMutation({
		mutationFn: async () => {
			await fetch(`/api/comments/${comment._id}`, {
				method: 'DELETE',
				credentials: 'include',
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			toast({ title: 'Komentar dihapus' });
		},
		onError: (err: any) => {
			toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' });
		},
	});

	return (
		<div className={depth > 0 ? 'ml-4 border-l pl-3' : ''}>
			<div className="rounded border bg-card p-2 space-y-1">
				<div className="flex items-center gap-1.5 text-xs">
					<span className="font-medium">
						{comment.isAnonymous ? 'Anonim' : comment.displayName}
					</span>
					<span className="text-muted-foreground">{timeAgo(comment.createdAt)}</span>
					{comment.editedAt && <span className="text-muted-foreground italic">(diedit)</span>}
				</div>
				<p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
				<div className="flex gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 text-xs text-muted-foreground"
						onClick={() => setReplying(!replying)}
					>
						<CornerDownRight className="h-3 w-3 mr-0.5" />
						Balas
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 text-xs text-muted-foreground hover:text-destructive"
						onClick={() => setDeleteDialogOpen(true)}
						disabled={deleteMut.isPending}
					>
						{deleteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-0.5" />}
						Hapus
					</Button>
				</div>
			</div>

			<ConfirmDeleteAlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Hapus komentar?"
				description="Komentar ini beserta seluruh balasannya akan dihapus permanen."
				isPending={deleteMut.isPending}
				onConfirm={async () => {
					await deleteMut.mutateAsync();
				}}
			/>

			{replying && (
				<div className="ml-4 mt-1">
					<ReplyForm
						targetType={targetType}
						targetId={targetId}
						parentId={comment._id}
						queryKey={queryKey}
						onCancel={() => setReplying(false)}
					/>
				</div>
			)}

			{comment.replies && comment.replies.length > 0 && (
				<div className="mt-1 space-y-1">
					{comment.replies.map((child) => (
						<ModerationNode
							key={child._id}
							comment={child}
							queryKey={queryKey}
							targetType={targetType}
							targetId={targetId}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}
