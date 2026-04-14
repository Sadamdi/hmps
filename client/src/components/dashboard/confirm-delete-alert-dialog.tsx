import { Button } from '@/components/ui/button';
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export type ConfirmDeleteAlertDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: ReactNode;
	onConfirm: () => void | Promise<void>;
	isPending?: boolean;
	confirmLabel?: string;
	cancelLabel?: string;
	contentClassName?: string;
};

export function ConfirmDeleteAlertDialog({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	isPending = false,
	confirmLabel = 'Hapus',
	cancelLabel = 'Batal',
	contentClassName,
}: ConfirmDeleteAlertDialogProps) {
	const handleConfirm = async () => {
		try {
			await Promise.resolve(onConfirm());
			onOpenChange(false);
		} catch {
			// Kesalahan ditangani pemanggil (toast, dll.)
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				className={cn(
					'w-[calc(100vw-1rem)] max-w-lg max-h-[90vh] overflow-y-auto gap-4',
					contentClassName,
				)}>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description != null && description !== '' ? (
						typeof description === 'string' ? (
							<AlertDialogDescription>{description}</AlertDialogDescription>
						) : (
							<div className="text-sm text-muted-foreground">{description}</div>
						)
					) : null}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel type="button" disabled={isPending}>
						{cancelLabel}
					</AlertDialogCancel>
					<Button
						type="button"
						variant="destructive"
						disabled={isPending}
						onClick={() => void handleConfirm()}>
						{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						{confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
