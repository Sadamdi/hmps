import { Button } from '@/components/ui/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface SimpleSelectOption {
	value: string;
	label: string;
}

interface SimpleSelectProps {
	value: string;
	onChange: (value: string) => void;
	options: SimpleSelectOption[];
	placeholder?: string;
	className?: string;
	contentClassName?: string;
	disabled?: boolean;
}

export function SimpleSelect({
	value,
	onChange,
	options,
	placeholder = 'Pilih...',
	className,
	contentClassName,
	disabled = false,
}: SimpleSelectProps) {
	const [open, setOpen] = useState(false);

	const selectedOption = options.find((o) => o.value === value);
	const displayLabel = selectedOption ? selectedOption.label : placeholder;

	const handleSelect = (optionValue: string) => {
		onChange(optionValue);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-haspopup="listbox"
					disabled={disabled}
					className={cn(
						'w-full justify-between font-normal h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						!value && 'text-muted-foreground',
						className
					)}>
					<span className="truncate">{displayLabel}</span>
					<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn(
					'w-[var(--radix-popover-trigger-width)] min-w-[8rem] p-1 max-h-[min(16rem,70vh)] overflow-y-auto',
					contentClassName
				)}
				align="start"
				sideOffset={4}
				onOpenAutoFocus={(e) => e.preventDefault()}>
				<ul role="listbox" className="outline-none">
					{options.map((opt) => (
						<li key={opt.value} role="option" aria-selected={value === opt.value}>
							<button
								type="button"
								className={cn(
									'relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-3 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
									value === opt.value && 'bg-accent'
								)}
								onClick={() => handleSelect(opt.value)}>
								{opt.label}
								{value === opt.value && (
									<span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
										✓
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
