/**
 * Placeholder Enco mascot GLB until Blender export from maskot-ti.blend.
 * Run: node ops/generate-enco-placeholder-glb.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'attached_assets/3d/enco/exports');
const publicDir = path.join(root, 'public/assets/mascot');
const outFile = path.join(outDir, 'enco-mascot.glb');
const publicFile = path.join(publicDir, 'enco.glb');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const scene = new THREE.Scene();
scene.name = 'EncoPlaceholder';

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6b, metalness: 0.2, roughness: 0.6 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.35 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x67e8f9, emissiveIntensity: 0.5 });

const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.7, 8, 16), bodyMat);
body.name = 'Body';
body.position.y = 0.85;

const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), bodyMat);
head.name = 'Head';
head.position.y = 1.55;

const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMat);
eyeL.position.set(-0.12, 1.62, 0.3);
const eyeR = eyeL.clone();
eyeR.position.x = 0.12;

const badge = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 24), accentMat);
badge.name = 'Badge';
badge.position.set(0, 1.05, 0.42);
badge.rotation.x = Math.PI / 2;

const group = new THREE.Group();
group.name = 'EncoMascot';
group.add(body, head, eyeL, eyeR, badge);
scene.add(group);

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(2, 4, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const exporter = new GLTFExporter();
const arrayBuffer = await new Promise((resolve, reject) => {
	exporter.parse(
		scene,
		(result) => {
			if (result instanceof ArrayBuffer) resolve(result);
			else reject(new Error('Expected binary GLB'));
		},
		(err) => reject(err),
		{ binary: true, animations: [] },
	);
});

const buf = Buffer.from(arrayBuffer);
fs.writeFileSync(outFile, buf);
fs.writeFileSync(publicFile, buf);
console.log(`Wrote placeholder GLB (${buf.length} bytes)`);
console.log(`  ${outFile}`);
console.log(`  ${publicFile}`);
