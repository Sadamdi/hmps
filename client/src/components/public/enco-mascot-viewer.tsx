import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
	Center,
	OrbitControls,
	useAnimations,
	useGLTF,
} from '@react-three/drei';
import type { AnimationAction, Group, Object3D } from 'three';

export type EncoMascotState = 'idle' | 'think' | 'talk' | 'wave';

const GLB_URL = '/assets/mascot/enco.glb';

const HIDDEN_MESH_NAMES = new Set([
	'cdo_ik',
	'cdo_pole',
	'ik',
	'pole',
]);

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => setReduced(mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	}, []);
	return reduced;
}

function useWebGLSupported(): boolean {
	const [ok, setOk] = useState(true);
	useEffect(() => {
		try {
			const canvas = document.createElement('canvas');
			const gl =
				canvas.getContext('webgl2') || canvas.getContext('webgl');
			setOk(!!gl);
		} catch {
			setOk(false);
		}
	}, []);
	return ok;
}

function sanitizeMascotScene(root: Object3D) {
	root.traverse((child) => {
		if (HIDDEN_MESH_NAMES.has(child.name.toLowerCase())) {
			child.visible = false;
		}
	});
}

function pickClipName(names: string[], state: EncoMascotState): string | null {
	if (names.length === 0) return null;
	const lower = names.map((n) => n.toLowerCase());
	const find = (...keys: string[]) => {
		const idx = lower.findIndex((n) => keys.some((k) => n.includes(k)));
		return idx >= 0 ? names[idx] : null;
	};

	switch (state) {
		case 'wave':
			return find('wave', 'hello', 'greet') ?? find('idle', 'stand') ?? names[0];
		case 'talk':
			return find('talk', 'speak', 'chat') ?? find('idle', 'stand') ?? names[0];
		case 'think':
			return find('think', 'ponder') ?? find('idle', 'stand') ?? names[0];
		default:
			return find('idle', 'stand', 'default', 'action') ?? names[0];
	}
}

function GlbEnco({ state }: { state: EncoMascotState }) {
	const group = useRef<Group>(null);
	const { scene, animations } = useGLTF(GLB_URL);
	const { actions, names } = useAnimations(animations, group);
	const prepared = useMemo(() => {
		const clone = scene.clone(true);
		sanitizeMascotScene(clone);
		return clone;
	}, [scene]);

	const activeAction = useRef<AnimationAction | null>(null);

	useEffect(() => {
		const clipName = pickClipName(names, state);
		if (!clipName || !actions[clipName]) return;

		const next = actions[clipName];
		if (activeAction.current && activeAction.current !== next) {
			activeAction.current.fadeOut(0.25);
		}
		next.reset().fadeIn(0.25).play();
		activeAction.current = next;

		return () => {
			next?.fadeOut(0.15);
		};
	}, [actions, names, state]);

	useFrame((_, delta) => {
		const g = group.current;
		if (!g) return;
		const action = activeAction.current;
		if (!action) return;

		const speed =
			state === 'talk' ? 1.35 : state === 'think' ? 0.65 : state === 'wave' ? 1.1 : 1;
		action.timeScale = speed;

		// Extra life when no dedicated clips per state
		const t = performance.now() * 0.001;
		if (state === 'talk') {
			g.position.y = Math.sin(t * 10) * 0.02;
		} else if (state === 'think') {
			g.rotation.z = Math.sin(t * 2.5) * 0.04;
		} else if (state === 'wave') {
			g.rotation.y = Math.sin(t * 5) * 0.12;
		} else {
			g.position.y = Math.sin(t * 2) * 0.015;
			g.rotation.z *= 0.9;
			g.rotation.y *= 0.9;
		}
	});

	return (
		<group ref={group} position={[0, -0.95, 0]}>
			<Center>
				<primitive object={prepared} scale={1.85} />
			</Center>
		</group>
	);
}

/** Fallback bila GLB belum tersedia */
function ProceduralEnco({ state }: { state: EncoMascotState }) {
	const root = useRef<Group>(null);
	useFrame(({ clock }) => {
		const g = root.current;
		if (!g) return;
		const t = clock.getElapsedTime();
		g.position.y = Math.sin(t * 2.2) * 0.05;
		if (state === 'think') g.rotation.z = Math.sin(t * 3) * 0.08;
		else if (state === 'talk') g.rotation.y = Math.sin(t * 8) * 0.1;
		else if (state === 'wave') g.rotation.y = Math.sin(t * 4) * 0.2;
	});

	return (
		<group ref={root} scale={0.85}>
			<mesh position={[0, 0.85, 0]}>
				<capsuleGeometry args={[0.45, 0.7, 8, 16]} />
				<meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.25} />
			</mesh>
			<mesh position={[0, 1.55, 0]}>
				<sphereGeometry args={[0.38, 24, 24]} />
				<meshStandardMaterial color="#7dd3fc" emissive="#22d3ee" emissiveIntensity={0.2} />
			</mesh>
		</group>
	);
}

function EncoScene({ state }: { state: EncoMascotState }) {
	return (
		<>
			<ambientLight intensity={1.1} />
			<directionalLight position={[2, 4, 3]} intensity={1.4} color="#ffffff" />
			<directionalLight position={[-2, 2, -1]} intensity={0.6} color="#67e8f9" />
			<pointLight position={[0, 1.5, 1.5]} intensity={0.8} color="#22d3ee" />
			<Suspense fallback={<ProceduralEnco state={state} />}>
				<GlbEnco state={state} />
			</Suspense>
			<OrbitControls
				enableZoom={false}
				enablePan={false}
				enableRotate={false}
				autoRotate={state === 'idle'}
				autoRotateSpeed={1.2}
			/>
		</>
	);
}

function EncoStaticFallback({
	className,
	size,
}: {
	className?: string;
	size: number;
}) {
	return (
		<div
			className={`flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-[#1a3a6b] border border-cyan-400/50 ${className ?? ''}`}
			style={{ width: size, height: size }}
			aria-hidden>
			<span className="text-cyan-100 font-bold text-lg">E</span>
		</div>
	);
}

export function EncoMascotViewer({
	state = 'idle',
	className,
	size = 64,
}: {
	state?: EncoMascotState;
	className?: string;
	size?: number;
}) {
	return (
		<MascotErrorBoundary className={className} size={size}>
			<EncoMascotViewerInner state={state} className={className} size={size} />
		</MascotErrorBoundary>
	);
}

class MascotErrorBoundary extends Component<
	{ children: React.ReactNode; className?: string; size: number },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	render() {
		if (this.state.failed) {
			return (
				<EncoStaticFallback
					className={this.props.className}
					size={this.props.size}
				/>
			);
		}
		return this.props.children;
	}
}

function EncoMascotViewerInner({
	state = 'idle',
	className,
	size = 64,
}: {
	state?: EncoMascotState;
	className?: string;
	size?: number;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const webglOk = useWebGLSupported();

	if (reducedMotion || !webglOk) {
		return <EncoStaticFallback className={className} size={size} />;
	}

	return (
		<div
			className={className}
			style={{ width: size, height: size }}
			aria-hidden>
			<Canvas
				camera={{ position: [0, 0.15, 1.55], fov: 32 }}
				gl={{ antialias: true, alpha: true }}
				dpr={[1, 2]}
				style={{ background: 'transparent' }}>
				<EncoScene state={state} />
			</Canvas>
		</div>
	);
}

useGLTF.preload(GLB_URL);
