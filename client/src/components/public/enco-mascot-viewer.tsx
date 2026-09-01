import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import type { Group } from 'three';

export type EncoMascotState = 'idle' | 'think' | 'talk' | 'wave';

const GLB_URL = '/assets/mascot/enco.glb';

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

/** Procedural placeholder until maskot-ti.blend is exported to GLB. */
function ProceduralEnco({ state }: { state: EncoMascotState }) {
	const root = useRef<Group>(null);
	useFrame(({ clock }) => {
		const g = root.current;
		if (!g) return;
		const t = clock.getElapsedTime();
		const bob = Math.sin(t * 2) * 0.04;
		g.position.y = bob;
		if (state === 'think') {
			g.rotation.z = Math.sin(t * 3) * 0.06;
		} else if (state === 'talk') {
			g.rotation.y = Math.sin(t * 8) * 0.08;
			g.scale.setScalar(1 + Math.sin(t * 12) * 0.02);
		} else if (state === 'wave') {
			g.rotation.y = Math.sin(t * 4) * 0.15;
		} else {
			g.rotation.z *= 0.92;
			g.rotation.y *= 0.92;
			g.scale.setScalar(1);
		}
	});

	return (
		<group ref={root} scale={0.9}>
			<mesh position={[0, 0.85, 0]}>
				<capsuleGeometry args={[0.45, 0.7, 8, 16]} />
				<meshStandardMaterial color="#1a3a6b" metalness={0.25} roughness={0.55} />
			</mesh>
			<mesh position={[0, 1.55, 0]}>
				<sphereGeometry args={[0.38, 24, 24]} />
				<meshStandardMaterial color="#1a3a6b" metalness={0.25} roughness={0.55} />
			</mesh>
			<mesh position={[-0.12, 1.62, 0.3]}>
				<sphereGeometry args={[0.06, 12, 12]} />
				<meshStandardMaterial
					color="#e0f2fe"
					emissive="#22d3ee"
					emissiveIntensity={0.45}
				/>
			</mesh>
			<mesh position={[0.12, 1.62, 0.3]}>
				<sphereGeometry args={[0.06, 12, 12]} />
				<meshStandardMaterial
					color="#e0f2fe"
					emissive="#22d3ee"
					emissiveIntensity={0.45}
				/>
			</mesh>
			<mesh position={[0, 1.05, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[0.18, 0.04, 8, 24]} />
				<meshStandardMaterial
					color="#22d3ee"
					emissive="#0e7490"
					emissiveIntensity={0.35}
				/>
			</mesh>
		</group>
	);
}

function GlbEnco({ state }: { state: EncoMascotState }) {
	const { scene, animations } = useGLTF(GLB_URL);
	const root = useRef<Group>(null);
	const cloned = useMemo(() => scene.clone(true), [scene]);

	useFrame(({ clock }) => {
		const g = root.current;
		if (!g) return;
		const t = clock.getElapsedTime();
		if (animations.length === 0) {
			g.rotation.y = Math.sin(t * (state === 'talk' ? 6 : 2)) * 0.05;
			return;
		}
		// When real GLB has named actions, map state → clip (future)
	});

	return (
		<group ref={root}>
			<primitive object={cloned} scale={1} position={[0, -0.2, 0]} />
		</group>
	);
}

function EncoScene({ state, useGlb }: { state: EncoMascotState; useGlb: boolean }) {
	return (
		<>
			<ambientLight intensity={0.65} />
			<directionalLight position={[2, 4, 3]} intensity={1.1} />
			{useGlb ? (
				<Suspense fallback={<ProceduralEnco state={state} />}>
					<GlbEnco state={state} />
				</Suspense>
			) : (
				<ProceduralEnco state={state} />
			)}
			<OrbitControls
				enableZoom={false}
				enablePan={false}
				enableRotate={false}
				autoRotate={state === 'idle'}
				autoRotateSpeed={0.8}
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
			className={`flex items-center justify-center rounded-full bg-gradient-to-br from-[#1a3a6b] to-[#0e2a56] border border-cyan-400/40 ${className ?? ''}`}
			style={{ width: size, height: size }}
			aria-hidden>
			<span className="text-cyan-200 font-bold text-lg tracking-wider">E</span>
		</div>
	);
}

export function EncoMascotViewer({
	state = 'idle',
	className,
	size = 64,
	forceProcedural = false,
}: {
	state?: EncoMascotState;
	className?: string;
	size?: number;
	/** Skip GLB fetch (mobile / reduced motion) */
	forceProcedural?: boolean;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const webglOk = useWebGLSupported();
	const [glbAvailable, setGlbAvailable] = useState(false);

	useEffect(() => {
		if (forceProcedural || reducedMotion) return;
		let cancelled = false;
		fetch(GLB_URL, { method: 'HEAD' })
			.then((r) => {
				if (!cancelled) setGlbAvailable(r.ok);
			})
			.catch(() => {
				if (!cancelled) setGlbAvailable(false);
			});
		return () => {
			cancelled = true;
		};
	}, [forceProcedural, reducedMotion]);

	if (reducedMotion || !webglOk) {
		return (
			<EncoStaticFallback className={className} size={size} />
		);
	}

	const useGlb = !forceProcedural && glbAvailable;

	return (
		<div
			className={className}
			style={{ width: size, height: size }}
			aria-hidden>
			<Canvas
				camera={{ position: [0, 1.2, 2.8], fov: 42 }}
				gl={{ antialias: true, alpha: true }}
				dpr={[1, 1.5]}>
				<EncoScene state={state} useGlb={useGlb} />
			</Canvas>
		</div>
	);
}
