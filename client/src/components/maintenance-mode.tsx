import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const GAME_W = 520;
const GAME_H = 200;
const GROUND = 36;
const DINO_X = 76;
const DINO_W = 44;
const DINO_H = 50;
const OBS_W = 30;
const OBS_H = 52;
const GRAVITY = 2400;
const JUMP_V0 = 680;
const BASE_SPEED = 280;
const SPEED_PER_SCORE = 14;
const MAX_SPEED = 560;

type GameMutable = {
	running: boolean;
	dinoY: number;
	dinoVy: number;
	obstacleX: number;
	score: number;
	scoredThisLap: boolean;
	lastTime: number;
};

function createInitialGame(): GameMutable {
	return {
		running: true,
		dinoY: 0,
		dinoVy: 0,
		obstacleX: GAME_W + 60,
		score: 0,
		scoredThisLap: false,
		lastTime: 0,
	};
}

function applyPhysics(g: GameMutable, dt: number) {
	g.dinoVy -= GRAVITY * dt;
	g.dinoY += g.dinoVy * dt;
	if (g.dinoY < 0) {
		g.dinoY = 0;
		g.dinoVy = 0;
	}
	const spd = Math.min(BASE_SPEED + g.score * SPEED_PER_SCORE, MAX_SPEED);
	g.obstacleX -= spd * dt;
}

function updateScoreAndRespawn(
	g: GameMutable,
	onScore: (n: number) => void
) {
	if (g.obstacleX + OBS_W < DINO_X && !g.scoredThisLap) {
		g.scoredThisLap = true;
		g.score += 1;
		onScore(g.score);
	}
	if (g.obstacleX < -OBS_W) {
		g.obstacleX = GAME_W + 48 + Math.random() * 120;
		g.scoredThisLap = false;
	}
}

function isCollision(g: GameMutable): boolean {
	const hitX =
		g.obstacleX < DINO_X + DINO_W - 6 && g.obstacleX + OBS_W > DINO_X + 8;
	const hitY = g.dinoY < OBS_H - 8;
	return hitX && hitY;
}

function syncSprites(
	g: GameMutable,
	dino: HTMLDivElement | null,
	obs: HTMLDivElement | null
) {
	if (dino) dino.style.bottom = `${g.dinoY}px`;
	if (obs) obs.style.left = `${g.obstacleX}px`;
}

function DinoRun() {
	const [score, setScore] = useState(0);
	const [gameOver, setGameOver] = useState(false);
	const [highScore, setHighScore] = useState(() => {
		try {
			return Number(localStorage.getItem('hmps-runner-hi')) || 0;
		} catch {
			return 0;
		}
	});

	const game = useRef<GameMutable>(createInitialGame());
	const highScoreRef = useRef(0);
	const dinoRef = useRef<HTMLDivElement>(null);
	const obstacleRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef(0);
	const startLoopRef = useRef<() => void>(() => {});

	const [brokeRecordThisGame, setBrokeRecordThisGame] = useState(false);
	highScoreRef.current = highScore;

	const tryJump = useCallback(() => {
		const g = game.current;
		if (!g.running || gameOver) return;
		if (g.dinoY <= 2) {
			g.dinoVy = JUMP_V0;
		}
	}, [gameOver]);

	const handleRestart = useCallback(() => {
		cancelAnimationFrame(rafRef.current);
		game.current = createInitialGame();
		setBrokeRecordThisGame(false);
		setGameOver(false);
		setScore(0);
		if (dinoRef.current) dinoRef.current.style.bottom = '0px';
		if (obstacleRef.current)
			obstacleRef.current.style.left = `${game.current.obstacleX}px`;
		startLoopRef.current();
	}, []);

	useEffect(() => {
		const step = (now: number) => {
			const g = game.current;
			if (!g.running) return;

			const dt = Math.min((now - g.lastTime) / 1000, 0.055);
			if (g.lastTime === 0) {
				g.lastTime = now;
				rafRef.current = requestAnimationFrame(step);
				return;
			}
			g.lastTime = now;

			applyPhysics(g, dt);
			updateScoreAndRespawn(g, setScore);

			if (isCollision(g)) {
				g.running = false;
				setBrokeRecordThisGame(g.score > highScoreRef.current);
				setGameOver(true);
				setHighScore((hi) => {
					const next = Math.max(hi, g.score);
					try {
						localStorage.setItem('hmps-runner-hi', String(next));
					} catch {
						/* ignore */
					}
					return next;
				});
				return;
			}

			syncSprites(g, dinoRef.current, obstacleRef.current);
			rafRef.current = requestAnimationFrame(step);
		};

		startLoopRef.current = () => {
			cancelAnimationFrame(rafRef.current);
			game.current.lastTime = 0;
			rafRef.current = requestAnimationFrame(step);
		};

		startLoopRef.current();
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.code === 'Space' || e.key === ' ') {
				e.preventDefault();
				if (gameOver) return;
				tryJump();
			}
			if (gameOver && (e.code === 'Enter' || e.key === 'Enter')) {
				e.preventDefault();
				handleRestart();
			}
		};
		window.addEventListener('keydown', onKey, { passive: false });
		return () => window.removeEventListener('keydown', onKey);
	}, [tryJump, gameOver, handleRestart]);

	return (
		<div
			className="mx-auto mt-8 w-full max-w-[540px] px-3"
			role="application"
			aria-label="Mini runner: spasi untuk lompat">
			<div
				className={cn(
					'relative overflow-hidden rounded-2xl border border-white/10',
					'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950',
					'shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/5'
				)}
				style={{ width: GAME_W, height: GAME_H, maxWidth: '100%' }}>
				<div
					className="pointer-events-none absolute inset-0 opacity-40"
					style={{
						backgroundImage: [
							'radial-gradient(1px 1px at 20% 30%, white, transparent)',
							'radial-gradient(1px 1px at 70% 18%, white, transparent)',
							'radial-gradient(1px 1px at 40% 55%, white, transparent)',
							'radial-gradient(1px 1px at 88% 42%, white, transparent)',
						].join(', '),
					}}
				/>

				<div className="pointer-events-none absolute left-[10%] top-6 h-3 w-20 rounded-full bg-white/5 blur-sm" />
				<div className="pointer-events-none absolute right-[15%] top-10 h-2 w-14 rounded-full bg-white/5 blur-sm" />

				<div className="absolute right-4 top-3 z-10 flex flex-col items-end gap-0.5 font-mono text-[11px] text-slate-400 sm:text-xs">
					<span className="text-emerald-400/90">
						<span className="text-slate-500">SKOR</span> {score}
					</span>
					<span className="text-slate-500">
						REKOR <span className="text-slate-300">{highScore}</span>
					</span>
				</div>

				<div
					ref={dinoRef}
					className="absolute z-[2] flex flex-col items-center justify-end"
					style={{
						left: DINO_X,
						bottom: 0,
						width: DINO_W,
						height: DINO_H,
					}}>
					<div className="relative h-full w-[85%]">
						<div className="absolute bottom-0 left-1/2 h-[70%] w-[55%] -translate-x-1/2 rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-700 shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)]" />
						<div className="absolute bottom-[52%] left-[22%] h-2 w-2 rounded-full bg-white shadow-sm" />
						<div className="absolute bottom-0 left-[8%] h-2 w-[22%] rounded-sm bg-emerald-900/80" />
						<div className="absolute bottom-0 right-[8%] h-2 w-[22%] rounded-sm bg-emerald-900/80" />
					</div>
				</div>

				<div
					ref={obstacleRef}
					className="absolute bottom-0 z-[1]"
					style={{ left: game.current.obstacleX, width: OBS_W, height: OBS_H }}>
					<div className="h-full w-full rounded-t-md bg-gradient-to-b from-rose-900/90 to-slate-900 shadow-[inset_0_4px_0_rgba(255,255,255,0.06)]">
						<div className="mx-auto mt-1 h-1/3 w-1/2 rounded-sm bg-black/25" />
					</div>
				</div>

				<div
					className="absolute bottom-0 left-0 right-0 overflow-hidden border-t border-emerald-500/20 bg-gradient-to-b from-slate-800 to-slate-950"
					style={{ height: GROUND }}>
					<div
						className="absolute bottom-[14px] left-0 h-px w-[200%] opacity-50"
						style={{
							background:
								'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(148,163,184,0.35) 10px, rgba(148,163,184,0.35) 22px)',
							animation: 'maint-ground 5.5s linear infinite',
						}}
					/>
				</div>

				{gameOver && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-[2px]">
						<p className="mb-1 font-mono text-[10px] uppercase tracking-[0.35em] text-slate-500">
							Berhenti
						</p>
						<p className="mb-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
							Game over
						</p>
						<p className="mb-5 font-mono text-sm text-emerald-400/90">
							Skor: {score}
							{brokeRecordThisGame ? (
								<span className="ml-2 text-amber-400/90">Rekor baru!</span>
							) : null}
						</p>
						<button
							type="button"
							onClick={handleRestart}
							className={cn(
								'rounded-full px-6 py-2.5 text-sm font-medium',
								'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25',
								'transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50'
							)}>
							Main lagi
						</button>
						<p className="mt-4 text-xs text-slate-500">
							Enter — mulai lagi
						</p>
					</div>
				)}

				<button
					type="button"
					className="absolute inset-0 z-[5] cursor-pointer bg-transparent md:hidden"
					aria-label="Ketuk untuk lompat"
					onClick={() => !gameOver && tryJump()}
				/>
			</div>

			<style>{`
				@keyframes maint-ground {
					from { transform: translateX(0); }
					to { transform: translateX(-50%); }
				}
			`}</style>

			<p className="mt-4 text-center text-xs text-slate-500">
				<span className="text-slate-400">Spasi</span> lompat ·{' '}
				<span className="text-slate-400">Enter</span> saat game over untuk ulang
			</p>
		</div>
	);
}

export default function MaintenanceMode() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 text-slate-100">
			<div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
				Status
			</div>
			<h1 className="mb-2 text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
				Sedang pemeliharaan
			</h1>
			<p className="mb-1 max-w-md text-center text-sm text-slate-400 sm:text-base">
				Kami sedang memperbarui sistem. Silakan kembali lagi nanti.
			</p>
			<p className="mb-2 max-w-md text-center text-xs text-slate-500 sm:text-sm">
				Sambil menunggu, kamu bisa main runner ringan di bawah.
			</p>
			<DinoRun />
		</div>
	);
}
