import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NetworkStats {
	rxBytes: number;
	txBytes: number;
	rxRate: number; // bytes/sec since last sample
	txRate: number; // bytes/sec since last sample
	interfaces: { name: string; rxBytes: number; txBytes: number }[];
}

export interface StorageActivity {
	uploads: { sizeBytes: number; fileCount: number };
	attachedAssets: { sizeBytes: number; fileCount: number };
	uploadsDelta: number; // file count change since last sample
	attachedDelta: number;
	changedFiles: number;
}

export interface SystemHealthSnapshot {
	cpu: {
		usage: number;
		cores: number;
		model: string;
		speed: number;
	};
	ram: {
		total: number;
		used: number;
		free: number;
		usage: number;
	};
	disk: {
		total: number;
		used: number;
		available: number;
		usage: number;
	};
	uptime: {
		system: number;
		process: number;
		formatted: string;
	};
	loadAvg: [number, number, number];
	node: {
		heapUsed: number;
		heapTotal: number;
		rss: number;
		external: number;
		eventLoopLag: number;
	};
	history: { t: number; cpu: number; ram: number }[];
	network?: NetworkStats;
	storageActivity?: StorageActivity;
}

const HISTORY_MAX = 60;
const history: { t: number; cpu: number; ram: number }[] = [];

function formatUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	const parts: string[] = [];
	if (d > 0) parts.push(`${d}d`);
	if (h > 0 || d > 0) parts.push(`${h}h`);
	if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
	parts.push(`${s}s`);
	return parts.join(' ');
}

type CpuInfo = { usage: number; model: string; speed: number; cores: number };

/** 1s window + EMA — short samples (e.g. 100ms) look like ~100% on 1-vCPU hosts. */
const CPU_SAMPLE_MS = 1000;
const CPU_EMA_ALPHA = 0.35;

let cpuSampler: {
	idle: number;
	total: number;
	usage: number;
	model: string;
	speed: number;
	cores: number;
	timer: ReturnType<typeof setInterval> | null;
} = {
	idle: 0,
	total: 0,
	usage: 0,
	model: 'Unknown',
	speed: 0,
	cores: 1,
	timer: null,
};

function readCpuCounters(): Omit<CpuInfo, 'usage'> & { idle: number; total: number } {
	const cpus = os.cpus();
	let idle = 0;
	let total = 0;
	for (const cpu of cpus) {
		for (const type in cpu.times) {
			total += (cpu.times as Record<string, number>)[type];
		}
		idle += cpu.times.idle;
	}
	return {
		idle,
		total,
		model: cpus[0]?.model || 'Unknown',
		speed: cpus[0] ? cpus[0].speed / 1000 : 0,
		cores: cpus.length || 1,
	};
}

function ensureCpuSampler(): void {
	if (cpuSampler.timer) return;

	const first = readCpuCounters();
	const loadPerCore = os.loadavg()[0] / Math.max(1, first.cores);
	cpuSampler = {
		...first,
		// Seed from 1m load so the first SSE tick is not always 0
		usage: Math.max(0, Math.min(100, Math.round(loadPerCore * 100))),
		timer: null,
	};

	cpuSampler.timer = setInterval(() => {
		const next = readCpuCounters();
		const idleDiff = next.idle - cpuSampler.idle;
		const totalDiff = next.total - cpuSampler.total;
		const instant =
			totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : cpuSampler.usage;
		const smoothed = cpuSampler.usage * (1 - CPU_EMA_ALPHA) + instant * CPU_EMA_ALPHA;
		cpuSampler.idle = next.idle;
		cpuSampler.total = next.total;
		cpuSampler.model = next.model;
		cpuSampler.speed = next.speed;
		cpuSampler.cores = next.cores;
		cpuSampler.usage = Math.max(0, Math.min(100, Math.round(smoothed)));
	}, CPU_SAMPLE_MS);

	// Do not keep the event loop alive solely for metrics (tests / short scripts)
	if (typeof cpuSampler.timer.unref === 'function') {
		cpuSampler.timer.unref();
	}
}

function getCpuUsage(): Promise<CpuInfo> {
	ensureCpuSampler();
	return Promise.resolve({
		usage: cpuSampler.usage,
		model: cpuSampler.model,
		speed: cpuSampler.speed,
		cores: cpuSampler.cores,
	});
}

async function getEventLoopLag(): Promise<number> {
	return new Promise((resolve) => {
		const start = process.hrtime.bigint();
		setImmediate(() => {
			const delta = Number(process.hrtime.bigint() - start);
			const ms = delta / 1_000_000;
			resolve(Math.round(ms * 100) / 100);
		});
	});
}

async function getDiskUsage(): Promise<{ total: number; used: number; available: number; usage: number }> {
	try {
		const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $2,$3,$4}'");
		const parts = stdout.trim().split(/\s+/);
		const total = parseInt(parts[0] || '0', 10) * 1024;
		const used = parseInt(parts[1] || '0', 10) * 1024;
		const available = parseInt(parts[2] || '0', 10) * 1024;
		const usage = total > 0 ? Math.round((used / total) * 100) : 0;
		return { total, used, available, usage };
	} catch {
		return { total: 0, used: 0, available: 0, usage: 0 };
	}
}

export type DirSizeInfo = { size: string; fileCount: number };

async function getDirSize(dir: string): Promise<DirSizeInfo> {
	try {
		if (!fs.existsSync(dir)) return { size: '0B', fileCount: 0 };
		const [{ stdout: sizeOut }, { stdout: countOut }] = await Promise.all([
			execAsync(`du -sh ${JSON.stringify(dir)} 2>/dev/null | head -1`),
			execAsync(`find ${JSON.stringify(dir)} -type f 2>/dev/null | wc -l`),
		]);
		const size = sizeOut.trim().split(/\s+/)[0] || '0B';
		const fileCount = parseInt(countOut.trim(), 10) || 0;
		return { size, fileCount };
	} catch {
		return { size: '0B', fileCount: 0 };
	}
}

export async function getStorageBreakdown(appRoot = process.cwd()): Promise<{
	uploads: DirSizeInfo;
	attachedAssets: DirSizeInfo;
	total: string;
}> {
	const [uploads, attachedAssets] = await Promise.all([
		getDirSize(path.join(appRoot, 'uploads')),
		getDirSize(path.join(appRoot, 'attached_assets')),
	]);
	return { uploads, attachedAssets, total: '—' };
}

let lastSnapshotTime = 0;
let cachedSnapshot: SystemHealthSnapshot | null = null;
let pendingSnapshot: Promise<SystemHealthSnapshot> | null = null;

export async function getSystemHealth(): Promise<SystemHealthSnapshot> {
	const now = Date.now();
	// Serve cached snapshot within 2s window (dedupe concurrent polls)
	if (cachedSnapshot && now - lastSnapshotTime < 2000) {
		return cachedSnapshot;
	}
	if (pendingSnapshot) {
		return pendingSnapshot;
	}

	pendingSnapshot = (async (): Promise<SystemHealthSnapshot> => {
		const [cpu, eventLoopLag, disk] = await Promise.all([
			getCpuUsage(),
			getEventLoopLag(),
			getDiskUsage(),
		]);

		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const memUsage = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

		const mem = process.memoryUsage();

		history.push({
			t: Date.now(),
			cpu: cpu.usage,
			ram: memUsage,
		});
		while (history.length > HISTORY_MAX) {
			history.shift();
		}

		// Network + storage activity (sync, in-memory, fast)
		const network = getNetworkStats();
		const storageActivity = getStorageActivity();

		const snapshot: SystemHealthSnapshot = {
			cpu: {
				usage: cpu.usage,
				cores: cpu.cores,
				model: cpu.model,
				speed: cpu.speed,
			},
			ram: {
				total: totalMem,
				used: usedMem,
				free: freeMem,
				usage: memUsage,
			},
			disk,
			uptime: {
				system: os.uptime(),
				process: process.uptime(),
				formatted: formatUptime(os.uptime()),
			},
			loadAvg: os.loadavg() as [number, number, number],
			node: {
				heapUsed: mem.heapUsed,
				heapTotal: mem.heapTotal,
				rss: mem.rss,
				external: mem.external,
				eventLoopLag,
			},
			history: [...history],
			network,
			storageActivity,
		};
		cachedSnapshot = snapshot;
		lastSnapshotTime = Date.now();
		return snapshot;
	})().finally(() => {
		pendingSnapshot = null;
	});

	return pendingSnapshot;
}

export function getSystemHealthHistory(): { t: number; cpu: number; ram: number }[] {
	return [...history];
}

// ==================== Network I/O stats ====================

let lastNetSample: { t: number; interfaces: Map<string, { rxBytes: number; txBytes: number }> } | null = null;

function parseProcNetDev(): Map<string, { rxBytes: number; txBytes: number }> {
	const result = new Map<string, { rxBytes: number; txBytes: number }>();
	try {
		const content = fs.readFileSync('/proc/net/dev', 'utf-8');
		const lines = content.trim().split('\n').slice(2); // skip header
		for (const line of lines) {
			const parts = line.trim().split(/\s+/);
			if (parts.length < 17) continue;
			// Format: "eth0: rx_bytes rx_packets ... tx_bytes ..."
			let name = parts[0].replace(/:$/, '');
			// Handle case where interface name and colon are separated
			if (parts[0].endsWith(':')) {
				name = parts[0].slice(0, -1);
			}
			// Skip loopback for aggregate rate (but still list)
			const rxBytes = parseInt(parts[1], 10) || 0;
			// tx_bytes is at index 9 (after 8 rx fields)
			const txBytes = parseInt(parts[9], 10) || 0;
			result.set(name, { rxBytes, txBytes });
		}
	} catch {
		// /proc/net/dev not available (non-Linux) — fallback to os.networkInterfaces
		const nets = os.networkInterfaces();
		for (const [name, addrs] of Object.entries(nets)) {
			if (!addrs) continue;
			result.set(name, { rxBytes: 0, txBytes: 0 });
		}
	}
	return result;
}

export function getNetworkStats(): NetworkStats {
	const now = Date.now();
	const current = parseProcNetDev();
	let totalRx = 0;
	let totalTx = 0;
	const interfaces: { name: string; rxBytes: number; txBytes: number }[] = [];
	for (const [name, stats] of current) {
		// Skip loopback for aggregate
		if (name === 'lo') {
			interfaces.push({ name, rxBytes: stats.rxBytes, txBytes: stats.txBytes });
			continue;
		}
		totalRx += stats.rxBytes;
		totalTx += stats.txBytes;
		interfaces.push({ name, rxBytes: stats.rxBytes, txBytes: stats.txBytes });
	}

	let rxRate = 0;
	let txRate = 0;
	if (lastNetSample) {
		const dt = (now - lastNetSample.t) / 1000;
		if (dt > 0) {
			let prevRx = 0;
			let prevTx = 0;
			for (const [name, stats] of lastNetSample.interfaces) {
				if (name === 'lo') continue;
				prevRx += stats.rxBytes;
				prevTx += stats.txBytes;
			}
			rxRate = Math.max(0, Math.round((totalRx - prevRx) / dt));
			txRate = Math.max(0, Math.round((totalTx - prevTx) / dt));
		}
	}
	lastNetSample = { t: now, interfaces: current };
	return { rxBytes: totalRx, txBytes: totalTx, rxRate, txRate, interfaces };
}

// ==================== Storage Activity (delta) ====================

let lastStorageSample: { t: number; uploads: { fileCount: number; sizeBytes: number }; attached: { fileCount: number; sizeBytes: number } } | null = null;

function countFilesFast(dir: string): { fileCount: number; sizeBytes: number } {
	try {
		if (!fs.existsSync(dir)) return { fileCount: 0, sizeBytes: 0 };
		let fileCount = 0;
		let sizeBytes = 0;
		const walk = (d: string) => {
			try {
				const entries = fs.readdirSync(d, { withFileTypes: true });
				for (const entry of entries) {
					const full = path.join(d, entry.name);
					if (entry.isDirectory()) {
						walk(full);
					} else if (entry.isFile()) {
						fileCount++;
						try {
							sizeBytes += fs.statSync(full).size;
						} catch {
							// skip
						}
					}
				}
			} catch {
				// skip
			}
		};
		walk(dir);
		return { fileCount, sizeBytes };
	} catch {
		return { fileCount: 0, sizeBytes: 0 };
	}
}

export function getStorageActivity(appRoot = process.cwd()): StorageActivity {
	const now = Date.now();
	const uploads = countFilesFast(path.join(appRoot, 'uploads'));
	const attached = countFilesFast(path.join(appRoot, 'attached_assets'));

	let uploadsDelta = 0;
	let attachedDelta = 0;
	let changedFiles = 0;

	if (lastStorageSample) {
		uploadsDelta = uploads.fileCount - lastStorageSample.uploads.fileCount;
		attachedDelta = attached.fileCount - lastStorageSample.attached.fileCount;
		changedFiles = Math.abs(uploadsDelta) + Math.abs(attachedDelta);
	}

	lastStorageSample = { t: now, uploads, attached };

	return {
		uploads: { sizeBytes: uploads.sizeBytes, fileCount: uploads.fileCount },
		attachedAssets: { sizeBytes: attached.sizeBytes, fileCount: attached.fileCount },
		uploadsDelta,
		attachedDelta,
		changedFiles,
	};
}
