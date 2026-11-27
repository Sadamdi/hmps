import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Input password dengan tombol mata (lihat / sembunyikan). Dipakai di semua form login/daftar/ganti password. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentPropsWithoutRef<typeof Input>, 'type'>>(
	({ className, ...props }, ref) => {
		const [show, setShow] = useState(false);
		return (
			<div className="relative">
				<Input ref={ref} type={show ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
				<button
					type="button"
					onClick={() => setShow((v) => !v)}
					className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
					aria-label={show ? 'Sembunyikan password' : 'Lihat password'}
					aria-pressed={show}
					tabIndex={0}>
					{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
				</button>
			</div>
		);
	},
);
PasswordInput.displayName = 'PasswordInput';
