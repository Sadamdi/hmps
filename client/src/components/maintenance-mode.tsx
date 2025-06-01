import { useEffect, useRef, useState } from 'react';

// Komponen Dino Run sederhana
function DinoRun() {
	const [isJumping, setIsJumping] = useState(false);
	const [dinoBottom, setDinoBottom] = useState(0);
	const [obstacleLeft, setObstacleLeft] = useState(400);
	const [score, setScore] = useState(0);
	const [gameOver, setGameOver] = useState(false);
	const gameRef = useRef<HTMLDivElement>(null);
	const jumpHeight = 80;
	const gravity = 4;
	const obstacleSpeed = 4;

	// Dino jump
	const handleJump = () => {
		if (!isJumping && !gameOver) {
			setIsJumping(true);
			let upInterval = setInterval(() => {
				setDinoBottom((prev) => {
					if (prev < jumpHeight) {
						return prev + 8;
					} else {
						clearInterval(upInterval);
						let downInterval = setInterval(() => {
							setDinoBottom((down) => {
								if (down > 0) {
									return down - gravity;
								} else {
									clearInterval(downInterval);
									setIsJumping(false);
									return 0;
								}
							});
						}, 20);
						return prev;
					}
				});
			}, 20);
		}
	};

	// Obstacle movement
	useEffect(() => {
		if (gameOver) return;
		const moveObstacle = setInterval(() => {
			setObstacleLeft((prev) => {
				if (prev > -40) {
					return prev - obstacleSpeed;
				} else {
					setScore((s) => s + 1);
					return 400;
				}
			});
		}, 20);
		return () => clearInterval(moveObstacle);
	}, [gameOver]);

	// Collision detection
	useEffect(() => {
		if (obstacleLeft > 40 && obstacleLeft < 80 && dinoBottom < 40) {
			setGameOver(true);
		}
	}, [obstacleLeft, dinoBottom]);

	// Restart game
	const handleRestart = () => {
		setGameOver(false);
		setScore(0);
		setObstacleLeft(400);
		setDinoBottom(0);
	};

	// Keyboard control
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.code === 'Space' || e.key === ' ') {
				handleJump();
			}
			if (gameOver && (e.code === 'Enter' || e.key === 'Enter')) {
				handleRestart();
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	});

	return (
		<div
			ref={gameRef}
			className="relative w-[400px] h-[150px] mx-auto bg-white border rounded-lg overflow-hidden shadow-lg mt-8">
			{/* Dino */}
			<div
				className="absolute left-10 w-10 h-10 bg-green-600 rounded-b-full border-b-4 border-green-800"
				style={{ bottom: dinoBottom }}
			/>
			{/* Obstacle */}
			<div
				className="absolute bottom-0 w-8 h-16 bg-gray-700 rounded"
				style={{ left: obstacleLeft }}
			/>
			{/* Ground */}
			<div className="absolute bottom-0 left-0 w-full h-4 bg-yellow-400" />
			{/* Score */}
			<div className="absolute top-2 right-4 text-gray-700 font-bold">
				Score: {score}
			</div>
			{/* Game Over */}
			{gameOver && (
				<div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
					<div className="text-2xl font-bold text-red-600 mb-2">Game Over</div>
					<button
						onClick={handleRestart}
						className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600">
						Restart
					</button>
				</div>
			)}
		</div>
	);
}

export default function MaintenanceMode() {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
			<h1 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in">
				Web Maintenance
			</h1>
			<p className="text-gray-600 mb-2">Website sedang dalam pemeliharaan.</p>
			<p className="text-gray-500 mb-4">Mainkan Dino Run sambil menunggu!</p>
			<DinoRun />
			<div className="mt-6 text-gray-400 text-xs">
				Tekan <b>Spasi</b> untuk lompat, <b>Enter</b> untuk restart
			</div>
		</div>
	);
}
