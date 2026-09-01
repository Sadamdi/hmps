import type { EncoMascotState } from './enco-mascot-viewer';

const PORTRAIT_URL = '/assets/mascot/enco-portrait.png';

const STATE_CLASS: Record<EncoMascotState, string> = {
	idle: '',
	think: 'animate-pulse',
	talk: 'animate-[bounce_0.6s_ease-in-out_infinite]',
	wave: 'animate-bounce',
};

export function EncoAvatar({
	size = 44,
	state = 'idle',
	className = '',
	alt = 'Enco',
}: {
	size?: number;
	state?: EncoMascotState;
	className?: string;
	alt?: string;
}) {
	return (
		<img
			src={PORTRAIT_URL}
			alt={alt}
			width={size}
			height={size}
			className={`object-cover object-[center_28%] rounded-full select-none ${STATE_CLASS[state]} ${className}`}
			style={{ width: size, height: size }}
			draggable={false}
			loading="eager"
		/>
	);
}
