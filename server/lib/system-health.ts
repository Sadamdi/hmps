import os from 'os';

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

function getCpuUsage(): Promise<{ usage: number; model: string; speed: number; cores: number }> {
	return new Promise((resolve) => {
		const cpus1 = os.cpus();
		let idle1 = 0;
		let total1 = 0;
		for (const cpu of cpus1) {
			for (const type in cpu.times) {
				total1 += (cpu.times as Record<string, number>)[type];
			}
			idle1 += cpu.times.idle;
		}
		const model = cpus1.length > 0 ? cpus1[0].model : 'Unknown';
		const speed = cpus1.length > 0 ? cpus1[0].speed / 1000 : 0;

		setTimeout(() => {
			const cpus2 = os.cpus();
			let idle2 = 0;
			let total2 = 0;
			for (const cpu of cpus2) {
				for (const type in cpu.times) {
					total2 += (cpu.times as Record<string, number>)[type];
				}
				idle2 += cpu.times.idle;
			}
			const idleDiff = idle2 - idle1;
			const totalDiff = total2 - total1;
			const usage = totalDiff > 0 ? Math.round(((totalDiff - idleDiff) / totalDiff) * 100) : 0;
			resolve({
				usage: Math.max(0, Math.min(100, usage)),
				model,
				speed,
				cores: cpus2.length,
			});
		}, 100);
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
	return new Promise((resolve) => {
		const { exec } = require('child_process');
		exec("df -k / | tail -1 | awk '{print $2,$3,$4}'", (err: Error | null, stdout: string) => {
			if (err || !stdout.trim()) {
				resolve({ total: 0, used: 0, available: 0, usage: 0 });
				return;
			}
			const parts = stdout.trim().split(/\s+/);
			const total = parseInt(parts[0] || '0', 10) * 1024;
			const used = parseInt(parts[1] || '0', 10) * 1024;
			const available = parseInt(parts[2] || '0', 10) * 1024;
			const usage = total > 0 ? Math.round((used / total) * 100) : 0;
			resolve({ total, used, available, usage });
		});
	});
}

let lastSnapshotTime = 0;
let pendingSnapshot: Promise<SystemHealthSnapshot> | null = null;

export async function getSystemHealth(): Promise<SystemHealthSnapshot> {
	const now = Date.now();
	if (now - lastSnapshotTime < 2000 && pendingSnapshot) {
		return pendingSnapshot;
	}
	lastSnapshotTime = now;

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

		return {
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
		};
	})();

	return pendingSnapshot;
}

export function getSystemHealthHistory(): { t: number; cpu: number; ram: number }[] {
	return [...history];
}
