/**
 * Server Monitor — pengumpul metrik server (read-only) untuk `/api/monitor/v1/*`.
 *
 * - Sumber utama: `/proc`, `/sys`, `fs.statfs`, dan modul `os` (Linux penuh; OS lain fallback terbatas).
 * - Metrik berbasis selisih (CPU, jaringan, disk I/O, proses) memakai sampler bersama supaya hasil
 *   konsisten walau banyak klien memanggil bersamaan; jendela minimum antar-sampel ~1 detik.
 * - Tidak pernah mengekspos isi `.env`, argumen/cmdline proses, atau IP pengguna.
 * - Section ber-scope `full` hanya untuk key `full`.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import net from 'net';
import dns from 'dns';
import { execFile } from 'child_process';
import { monitorEventLoopDelay } from 'perf_hooks';
import { Worker } from 'worker_threads';
import mongoose from 'mongoose';

export type MonitorScope = 'basic' | 'full';

const IS_LINUX = process.platform === 'linux';
const CLK_TCK = 100;
const PAGE_SIZE = 4096;
const MIN_WINDOW_MS = 900;

const round = (n: number, d = 1): number => {
	const f = 10 ** d;
	return Math.round((Number.isFinite(n) ? n : 0) * f) / f;
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function readText(p: string): string | null {
	try {
		return fs.readFileSync(p, 'utf8');
	} catch {
		return null;
	}
}

function run(cmd: string, args: string[], timeoutMs = 3000): Promise<string | null> {
	return new Promise((resolve) => {
		try {
			execFile(
				cmd,
				args,
				{
					timeout: timeoutMs,
					maxBuffer: 2 * 1024 * 1024,
					env: {
						...process.env,
						PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}`,
					},
				},
				(err, stdout) => resolve(err ? null : String(stdout)),
			);
		} catch {
			resolve(null);
		}
	});
}

const cacheStore = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
	const hit = cacheStore.get(key);
	if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
	const value = await fn();
	cacheStore.set(key, { at: Date.now(), value });
	return value;
}

// ───────────────────────── CPU ─────────────────────────

type CpuTimes = {
	user: number;
	nice: number;
	system: number;
	idle: number;
	iowait: number;
	irq: number;
	softirq: number;
	steal: number;
};
type StatSnapshot = {
	total: CpuTimes;
	cores: CpuTimes[];
	ctxt: number;
	forks: number;
	running: number;
	blocked: number;
};

function parseCpuLine(line: string): CpuTimes {
	const p = line.trim().split(/\s+/).slice(1).map(Number);
	return {
		user: p[0] || 0,
		nice: p[1] || 0,
		system: p[2] || 0,
		idle: p[3] || 0,
		iowait: p[4] || 0,
		irq: p[5] || 0,
		softirq: p[6] || 0,
		steal: p[7] || 0,
	};
}

function readStat(): StatSnapshot | null {
	const txt = readText('/proc/stat');
	if (!txt) return null;
	const lines = txt.split('\n');
	const snap: StatSnapshot = {
		total: parseCpuLine(lines.find((l) => l.startsWith('cpu ')) || 'cpu 0'),
		cores: lines.filter((l) => /^cpu\d+ /.test(l)).map(parseCpuLine),
		ctxt: 0,
		forks: 0,
		running: 0,
		blocked: 0,
	};
	for (const l of lines) {
		if (l.startsWith('ctxt ')) snap.ctxt = Number(l.split(' ')[1]) || 0;
		else if (l.startsWith('processes ')) snap.forks = Number(l.split(' ')[1]) || 0;
		else if (l.startsWith('procs_running ')) snap.running = Number(l.split(' ')[1]) || 0;
		else if (l.startsWith('procs_blocked ')) snap.blocked = Number(l.split(' ')[1]) || 0;
	}
	return snap;
}

function cpuDelta(a: CpuTimes, b: CpuTimes) {
	const sum = (t: CpuTimes) =>
		t.user + t.nice + t.system + t.idle + t.iowait + t.irq + t.softirq + t.steal;
	const dt = Math.max(1, sum(b) - sum(a));
	const pct = (k: keyof CpuTimes) => round(((b[k] - a[k]) / dt) * 100, 1);
	const idle = ((b.idle + b.iowait - a.idle - a.iowait) / dt) * 100;
	return {
		usagePercent: round(100 - idle, 1),
		userPercent: round(((b.user + b.nice - a.user - a.nice) / dt) * 100, 1),
		systemPercent: round(((b.system + b.irq + b.softirq - a.system - a.irq - a.softirq) / dt) * 100, 1),
		iowaitPercent: pct('iowait'),
		stealPercent: pct('steal'),
		idlePercent: round(idle, 1),
	};
}

let lastStat: { t: number; snap: StatSnapshot } | null = null;
let cpuCache: {
	total: ReturnType<typeof cpuDelta>;
	cores: ReturnType<typeof cpuDelta>[];
	ctxtPerSec: number;
	forksPerSec: number;
	running: number;
	blocked: number;
} | null = null;

async function sampleCpu() {
	const now = Date.now();
	if (!lastStat) {
		const first = readStat();
		if (!first) return null;
		lastStat = { t: now, snap: first };
		await sleep(300);
	}
	const prev = lastStat;
	if (Date.now() - prev.t >= MIN_WINDOW_MS || !cpuCache) {
		const cur = readStat();
		if (!cur) return cpuCache;
		const t = Date.now();
		const secs = Math.max(0.05, (t - prev.t) / 1000);
		cpuCache = {
			total: cpuDelta(prev.snap.total, cur.total),
			cores: cur.cores.map((c, i) => cpuDelta(prev.snap.cores[i] || c, c)),
			ctxtPerSec: Math.round((cur.ctxt - prev.snap.ctxt) / secs),
			forksPerSec: round((cur.forks - prev.snap.forks) / secs, 1),
			running: cur.running,
			blocked: cur.blocked,
		};
		lastStat = { t, snap: cur };
	}
	return cpuCache;
}

function readPsi(): Record<string, { avg10: number; avg60: number; avg300: number }> | null {
	const out: Record<string, { avg10: number; avg60: number; avg300: number }> = {};
	for (const kind of ['cpu', 'memory', 'io']) {
		const txt = readText(`/proc/pressure/${kind}`);
		const some = txt?.split('\n').find((l) => l.startsWith('some'));
		if (!some) continue;
		const m = (k: string) => Number(some.match(new RegExp(`${k}=([\\d.]+)`))?.[1] || 0);
		out[kind] = { avg10: m('avg10'), avg60: m('avg60'), avg300: m('avg300') };
	}
	return Object.keys(out).length ? out : null;
}

async function collectCpu() {
	const cpuinfo = readText('/proc/cpuinfo');
	const osCpus = os.cpus();
	let model = osCpus[0]?.model?.trim() || 'unknown';
	let mhz = osCpus[0]?.speed || 0;
	let flags: string[] = [];
	if (cpuinfo) {
		model = cpuinfo.match(/model name\s*:\s*(.+)/)?.[1]?.trim() || model;
		const mhzs = (cpuinfo.match(/cpu MHz\s*:\s*[\d.]+/g) || []).map((m) => Number(m.split(":")[1]));
		if (mhzs.length) mhz = mhzs.reduce((a, b) => a + b, 0) / mhzs.length;
		const fl = cpuinfo.match(/flags\s*:\s*(.+)/)?.[1]?.split(' ') || [];
		flags = ['avx', 'avx2', 'avx512f', 'aes', 'sse4_2', 'sha_ni', 'hypervisor'].filter((f) =>
			fl.includes(f),
		);
	}
	const usage = await sampleCpu();
	const load = os.loadavg();
	return {
		model,
		logicalCores: osCpus.length,
		mhz: Math.round(mhz),
		architecture: os.arch(),
		features: flags,
		usage: usage?.total ?? null,
		perCore: usage?.cores ?? [],
		loadAverage: { m1: round(load[0], 2), m5: round(load[1], 2), m15: round(load[2], 2) },
		contextSwitchesPerSec: usage?.ctxtPerSec ?? null,
		forksPerSec: usage?.forksPerSec ?? null,
		runningTasks: usage?.running ?? null,
		blockedTasks: usage?.blocked ?? null,
		pressure: IS_LINUX ? readPsi() : null,
	};
}

// ───────────────────────── Memori ─────────────────────────

function readMeminfo(): Record<string, number> {
	const out: Record<string, number> = {};
	const txt = readText('/proc/meminfo');
	if (!txt) return out;
	for (const line of txt.split('\n')) {
		const m = line.match(/^(\w+)(?:\(\w+\))?:\s+(\d+)/);
		if (m) out[m[1]] = Number(m[2]) * 1024;
	}
	return out;
}

function readCgroupMemoryLimit(): number | null {
	for (const p of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
		const v = readText(p)?.trim();
		if (v && v !== 'max') {
			const n = Number(v);
			if (Number.isFinite(n) && n > 0 && n < 2 ** 60) return n;
		}
	}
	return null;
}

async function collectMemory() {
	const mi = readMeminfo();
	const total = mi.MemTotal ?? os.totalmem();
	const available = mi.MemAvailable ?? os.freemem();
	const used = total - available;
	const swapTotal = mi.SwapTotal ?? 0;
	const swapFree = mi.SwapFree ?? 0;
	const limit = IS_LINUX ? readCgroupMemoryLimit() : null;
	return {
		totalBytes: total,
		usedBytes: used,
		availableBytes: available,
		freeBytes: mi.MemFree ?? os.freemem(),
		usedPercent: round((used / total) * 100, 1),
		buffersBytes: mi.Buffers ?? null,
		cachedBytes: mi.Cached ?? null,
		sharedBytes: mi.Shmem ?? null,
		slabBytes: mi.Slab ?? null,
		dirtyBytes: mi.Dirty ?? null,
		swap: {
			totalBytes: swapTotal,
			usedBytes: swapTotal - swapFree,
			usedPercent: swapTotal ? round(((swapTotal - swapFree) / swapTotal) * 100, 1) : 0,
			configured: swapTotal > 0,
		},
		containerLimitBytes: limit,
	};
}

// ───────────────────────── Disk ─────────────────────────

const REAL_FS = new Set(['ext2', 'ext3', 'ext4', 'xfs', 'btrfs', 'zfs', 'f2fs', 'vfat', 'ntfs', 'overlay', 'ploop']);

async function collectDisk() {
	let mounts: { device: string; mount: string; fstype: string }[] = [];
	const txt = IS_LINUX ? readText('/proc/mounts') : null;
	if (txt) {
		const seen = new Set<string>();
		for (const line of txt.split('\n')) {
			const [device, mount, fstype] = line.split(' ');
			if (!device || !mount) continue;
			if (!(device.startsWith('/dev/') || REAL_FS.has(fstype))) continue;
			if (mount.startsWith('/snap') || mount.startsWith('/var/lib/docker')) continue;
			if (seen.has(device)) continue;
			seen.add(device);
			mounts.push({ device, mount, fstype });
		}
	} else {
		mounts = [{ device: 'local', mount: path.parse(process.cwd()).root, fstype: 'unknown' }];
	}
	const volumes = [];
	for (const m of mounts) {
		try {
			const s = await fs.promises.statfs(m.mount);
			const total = s.blocks * s.bsize;
			const free = s.bfree * s.bsize;
			const avail = s.bavail * s.bsize;
			const used = total - free;
			volumes.push({
				device: m.device,
				mount: m.mount,
				fstype: m.fstype,
				totalBytes: total,
				usedBytes: used,
				availableBytes: avail,
				usedPercent: total ? round((used / (used + avail)) * 100, 1) : 0,
				inodes: { total: s.files, free: s.ffree, usedPercent: s.files ? round(((s.files - s.ffree) / s.files) * 100, 1) : 0 },
			});
		} catch {
			/* mount tidak bisa dibaca — lewati */
		}
	}
	return { volumes };
}

type DiskCounters = { reads: number; writes: number; readBytes: number; writeBytes: number; busyMs: number };
let lastDisk: { t: number; c: Record<string, DiskCounters> } | null = null;
let diskRateCache: Record<string, ReturnType<typeof diskRates>> | null = null;

function readDiskstats(): Record<string, DiskCounters> {
	const out: Record<string, DiskCounters> = {};
	const txt = readText('/proc/diskstats');
	if (!txt) return out;
	const rows = txt
		.split('\n')
		.map((l) => l.trim().split(/\s+/))
		.filter((p) => p.length >= 14);
	const names = new Set(rows.map((p) => p[2]));
	for (const p of rows) {
		const name = p[2];
		if (/^(loop|ram|zram|dm-|sr)\d*/.test(name)) continue;
		const base = name.replace(/p?\d+$/, '');
		if (base !== name && names.has(base)) continue;
		out[name] = {
			reads: Number(p[3]),
			readBytes: Number(p[5]) * 512,
			writes: Number(p[7]),
			writeBytes: Number(p[9]) * 512,
			busyMs: Number(p[12]),
		};
	}
	return out;
}

function diskRates(a: DiskCounters, b: DiskCounters, secs: number) {
	return {
		readBytesPerSec: Math.max(0, Math.round((b.readBytes - a.readBytes) / secs)),
		writeBytesPerSec: Math.max(0, Math.round((b.writeBytes - a.writeBytes) / secs)),
		readIops: Math.max(0, Math.round((b.reads - a.reads) / secs)),
		writeIops: Math.max(0, Math.round((b.writes - a.writes) / secs)),
		busyPercent: Math.min(100, round(((b.busyMs - a.busyMs) / (secs * 1000)) * 100, 1)),
	};
}

async function collectDiskIo() {
	if (!IS_LINUX) return { available: false, devices: [] };
	const now = Date.now();
	if (!lastDisk) {
		lastDisk = { t: now, c: readDiskstats() };
		await sleep(300);
	}
	const prev = lastDisk;
	const cur = readDiskstats();
	if (Date.now() - prev.t >= MIN_WINDOW_MS || !diskRateCache) {
		const t = Date.now();
		const secs = Math.max(0.05, (t - prev.t) / 1000);
		diskRateCache = {};
		for (const [name, c] of Object.entries(cur)) {
			if (prev.c[name]) diskRateCache[name] = diskRates(prev.c[name], c, secs);
		}
		lastDisk = { t, c: cur };
	}
	const devices = Object.entries(cur).map(([name, c]) => ({
		device: name,
		totalReadBytes: c.readBytes,
		totalWriteBytes: c.writeBytes,
		...(diskRateCache?.[name] ?? {}),
	}));
	return { available: devices.length > 0, devices };
}

// ───────────────────────── Jaringan ─────────────────────────

type NetCounters = { rxBytes: number; txBytes: number; rxPackets: number; txPackets: number; rxErrors: number; txErrors: number; rxDrops: number; txDrops: number };
let lastNet: { t: number; c: Record<string, NetCounters> } | null = null;
let netRateCache: Record<string, { rxBytesPerSec: number; txBytesPerSec: number; rxPacketsPerSec: number; txPacketsPerSec: number }> | null = null;

function readNetDev(): Record<string, NetCounters> {
	const out: Record<string, NetCounters> = {};
	const txt = readText('/proc/net/dev');
	if (!txt) return out;
	for (const line of txt.split('\n').slice(2)) {
		const [name, rest] = line.split(':');
		if (!rest) continue;
		const p = rest.trim().split(/\s+/).map(Number);
		out[name.trim()] = {
			rxBytes: p[0], rxPackets: p[1], rxErrors: p[2], rxDrops: p[3],
			txBytes: p[8], txPackets: p[9], txErrors: p[10], txDrops: p[11],
		};
	}
	return out;
}

async function collectNetwork(scope: MonitorScope) {
	if (!IS_LINUX) return { available: false, interfaces: [] };
	const now = Date.now();
	if (!lastNet) {
		lastNet = { t: now, c: readNetDev() };
		await sleep(300);
	}
	const prev = lastNet;
	const cur = readNetDev();
	if (Date.now() - prev.t >= MIN_WINDOW_MS || !netRateCache) {
		const t = Date.now();
		const secs = Math.max(0.05, (t - prev.t) / 1000);
		netRateCache = {};
		for (const [name, c] of Object.entries(cur)) {
			const a = prev.c[name];
			if (!a) continue;
			netRateCache[name] = {
				rxBytesPerSec: Math.max(0, Math.round((c.rxBytes - a.rxBytes) / secs)),
				txBytesPerSec: Math.max(0, Math.round((c.txBytes - a.txBytes) / secs)),
				rxPacketsPerSec: Math.max(0, Math.round((c.rxPackets - a.rxPackets) / secs)),
				txPacketsPerSec: Math.max(0, Math.round((c.txPackets - a.txPackets) / secs)),
			};
		}
		lastNet = { t, c: cur };
	}
	const addrs = os.networkInterfaces();
	const interfaces = Object.entries(cur)
		.filter(([name]) => name !== 'lo')
		.map(([name, c]) => ({
			name,
			...c,
			...(netRateCache?.[name] ?? {}),
			...(scope === 'full'
				? { addresses: (addrs[name] || []).map((a) => ({ family: a.family, address: a.address })) }
				: {}),
		}));
	const sum = (k: 'rxBytesPerSec' | 'txBytesPerSec') =>
		interfaces.reduce((s, i) => s + ((i as any)[k] || 0), 0);
	return {
		available: true,
		totalRxBytesPerSec: sum('rxBytesPerSec'),
		totalTxBytesPerSec: sum('txBytesPerSec'),
		interfaces,
	};
}

const TCP_STATES: Record<string, string> = {
	'01': 'ESTABLISHED', '02': 'SYN_SENT', '03': 'SYN_RECV', '04': 'FIN_WAIT1', '05': 'FIN_WAIT2',
	'06': 'TIME_WAIT', '07': 'CLOSE', '08': 'CLOSE_WAIT', '09': 'LAST_ACK', '0A': 'LISTEN', '0B': 'CLOSING',
};

async function collectConnections(scope: MonitorScope) {
	if (!IS_LINUX) return { available: false };
	const states: Record<string, number> = {};
	const listening: { port: number; scope: 'public' | 'local'; protocol: string }[] = [];
	const seen = new Set<string>();
	for (const [file, proto] of [['tcp', 'tcp'], ['tcp6', 'tcp6']] as const) {
		const txt = readText(`/proc/net/${file}`);
		if (!txt) continue;
		for (const line of txt.split('\n').slice(1)) {
			const p = line.trim().split(/\s+/);
			if (p.length < 4) continue;
			const state = TCP_STATES[p[3]] || p[3];
			states[state] = (states[state] || 0) + 1;
			if (state === 'LISTEN') {
				const [addr, hexPort] = p[1].split(':');
				const port = parseInt(hexPort, 16);
				const local = /^(0100007F|0{31}1)$/i.test(addr);
				const key = `${port}:${local}`;
				if (!seen.has(key)) {
					seen.add(key);
					listening.push({ port, scope: local ? 'local' : 'public', protocol: proto });
				}
			}
		}
	}
	const udp =
		(readText('/proc/net/udp')?.split('\n').length ?? 1) - 2 +
		((readText('/proc/net/udp6')?.split('\n').length ?? 1) - 2);
	return {
		available: true,
		tcp: { total: Object.values(states).reduce((a, b) => a + b, 0), byState: states },
		udpSockets: Math.max(0, udp),
		...(scope === 'full' ? { listeningPorts: listening.sort((a, b) => a.port - b.port) } : {}),
	};
}

// ───────────────────────── Proses (seperti Task Manager) ─────────────────────────

let userMap: Map<number, string> | null = null;
function userName(uid: number): string {
	if (!userMap) {
		userMap = new Map();
		for (const line of (readText('/etc/passwd') || '').split('\n')) {
			const p = line.split(':');
			if (p.length > 2) userMap.set(Number(p[2]), p[0]);
		}
	}
	return userMap.get(uid) || String(uid);
}

type ProcRaw = { pid: number; name: string; state: string; ticks: number; threads: number; rssBytes: number; startTicks: number; uid: number };

async function readProcs(): Promise<Map<number, ProcRaw>> {
	const out = new Map<number, ProcRaw>();
	let entries: string[] = [];
	try {
		entries = (await fs.promises.readdir('/proc')).filter((d) => /^\d+$/.test(d));
	} catch {
		return out;
	}
	await Promise.all(
		entries.map(async (d) => {
			try {
				const stat = await fs.promises.readFile(`/proc/${d}/stat`, 'utf8');
				const l = stat.indexOf('(');
				const r = stat.lastIndexOf(')');
				const name = stat.slice(l + 1, r);
				const f = stat.slice(r + 2).split(' ');
				let uid = 0;
				try {
					uid = (await fs.promises.stat(`/proc/${d}`)).uid;
				} catch {
					/* proses selesai */
				}
				out.set(Number(d), {
					pid: Number(d),
					name,
					state: f[0],
					ticks: Number(f[11]) + Number(f[12]),
					threads: Number(f[17]),
					startTicks: Number(f[19]),
					rssBytes: Number(f[21]) * PAGE_SIZE,
					uid,
				});
			} catch {
				/* proses selesai saat dibaca */
			}
		}),
	);
	return out;
}

let lastProcs: { t: number; m: Map<number, ProcRaw> } | null = null;
let procCpuCache = new Map<number, number>();

export type ProcessQuery = { sort?: 'cpu' | 'mem' | 'pid' | 'name'; limit?: number; filter?: string };

async function collectProcesses(q: ProcessQuery = {}) {
	if (!IS_LINUX) return { available: false, processes: [] };
	const now = Date.now();
	if (!lastProcs) {
		lastProcs = { t: now, m: await readProcs() };
		await sleep(300);
	}
	const prev = lastProcs;
	const cur = await readProcs();
	if (Date.now() - prev.t >= MIN_WINDOW_MS) {
		const t = Date.now();
		const secs = Math.max(0.05, (t - prev.t) / 1000);
		procCpuCache = new Map();
		cur.forEach((p, pid) => {
			const a = prev.m.get(pid);
			if (a) procCpuCache.set(pid, round(((p.ticks - a.ticks) / CLK_TCK / secs) * 100, 1));
		});
		lastProcs = { t, m: cur };
	}
	const uptime = Number((readText('/proc/uptime') || '0').split(' ')[0]);
	const byState: Record<string, number> = {};
	let threads = 0;
	let list = Array.from(cur.values()).map((p) => {
		byState[p.state] = (byState[p.state] || 0) + 1;
		threads += p.threads;
		return {
			pid: p.pid,
			name: p.name,
			user: userName(p.uid),
			state: p.state,
			cpuPercent: procCpuCache.get(p.pid) ?? 0,
			memoryBytes: p.rssBytes,
			threads: p.threads,
			ageSeconds: Math.max(0, Math.round(uptime - p.startTicks / CLK_TCK)),
		};
	});
	const filter = (q.filter || '').toLowerCase().slice(0, 40);
	if (filter) list = list.filter((p) => p.name.toLowerCase().includes(filter));
	const sort = q.sort || 'cpu';
	list.sort((a, b) =>
		sort === 'mem' ? b.memoryBytes - a.memoryBytes
		: sort === 'pid' ? a.pid - b.pid
		: sort === 'name' ? a.name.localeCompare(b.name)
		: b.cpuPercent - a.cpuPercent || b.memoryBytes - a.memoryBytes,
	);
	const limit = Math.min(50, Math.max(1, q.limit || 10));
	return {
		available: true,
		total: cur.size,
		threads,
		byState,
		sort,
		processes: list.slice(0, limit),
	};
}

// ───────────────────────── Sistem, GPU, runtime aplikasi ─────────────────────────

async function detectVirt(): Promise<string> {
	return cached('virt', 3600_000, async () => {
		const v = (await run('systemd-detect-virt', []))?.trim();
		if (v) return v;
		if (fs.existsSync('/proc/vz')) return 'openvz';
		if (fs.existsSync('/.dockerenv')) return 'docker';
		return 'unknown';
	});
}

async function collectSystem(scope: MonitorScope) {
	const osRelease = readText('/etc/os-release') || '';
	const pretty = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1] || `${os.type()} ${os.release()}`;
	const upSec = Number((readText('/proc/uptime') || '').split(' ')[0]) || os.uptime();
	const loadavg = readText('/proc/loadavg')?.split(' ') || [];
	const fileNr = readText('/proc/sys/fs/file-nr')?.trim().split(/\s+/).map(Number);
	return {
		...(scope === 'full' ? { hostname: os.hostname() } : {}),
		os: pretty,
		platform: process.platform,
		kernel: os.release(),
		architecture: os.arch(),
		virtualization: IS_LINUX ? await detectVirt() : 'n/a',
		uptimeSeconds: Math.round(upSec),
		bootTime: new Date(Date.now() - upSec * 1000).toISOString(),
		serverTime: new Date().toISOString(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		totalProcesses: loadavg[3] ? Number(loadavg[3].split('/')[1]) : null,
		openFiles: fileNr ? { allocated: fileNr[0], max: fileNr[2] } : null,
		nodeVersion: process.version,
	};
}

async function collectGpu() {
	return cached('gpu', 15_000, async () => {
		const out = await run('nvidia-smi', [
			'--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,driver_version',
			'--format=csv,noheader,nounits',
		]);
		if (!out) {
			return { available: false, reason: 'Tidak ada GPU NVIDIA terdeteksi (server/virtualisasi ini tanpa GPU).', gpus: [] };
		}
		const gpus = out
			.trim()
			.split('\n')
			.map((l) => l.split(',').map((s) => s.trim()))
			.map((p) => ({
				name: p[0],
				utilizationPercent: Number(p[1]),
				memoryUsedMiB: Number(p[2]),
				memoryTotalMiB: Number(p[3]),
				temperatureC: Number(p[4]),
				powerWatts: Number(p[5]),
				driverVersion: p[6],
			}));
		return { available: true, gpus };
	});
}

const eld = monitorEventLoopDelay({ resolution: 20 });
let eldStarted = false;

async function collectApp() {
	if (!eldStarted) {
		eld.enable();
		eldStarted = true;
	}
	const m = process.memoryUsage();
	const cu = process.cpuUsage();
	return {
		pid: process.pid,
		nodeVersion: process.version,
		uptimeSeconds: Math.round(process.uptime()),
		memory: { rssBytes: m.rss, heapUsedBytes: m.heapUsed, heapTotalBytes: m.heapTotal, externalBytes: m.external },
		cpuTimeMs: { user: Math.round(cu.user / 1000), system: Math.round(cu.system / 1000) },
		eventLoopDelayMs: {
			mean: round(eld.mean / 1e6, 2),
			p99: round(eld.percentile(99) / 1e6, 2),
			max: round(eld.max / 1e6, 2),
		},
	};
}

function tcpPing(host: string, port: number, timeoutMs = 2000): Promise<number | null> {
	return new Promise((resolve) => {
		const t0 = process.hrtime.bigint();
		const s = net.connect({ host, port });
		const done = (v: number | null) => {
			s.destroy();
			resolve(v);
		};
		s.setTimeout(timeoutMs, () => done(null));
		s.once('error', () => done(null));
		s.once('connect', () => done(round(Number(process.hrtime.bigint() - t0) / 1e6, 1)));
	});
}

async function collectLatency() {
	return cached('latency', 10_000, async () => {
		const t0 = process.hrtime.bigint();
		let dnsMs: number | null = null;
		try {
			await dns.promises.lookup('cloudflare.com');
			dnsMs = round(Number(process.hrtime.bigint() - t0) / 1e6, 1);
		} catch {
			/* DNS gagal */
		}
		const [cf, google] = await Promise.all([tcpPing('1.1.1.1', 443), tcpPing('8.8.8.8', 443)]);
		return { tcpConnectMs: { cloudflare: cf, google }, dnsLookupMs: dnsMs };
	});
}

// ───────────────────────── Layanan, MongoDB, keamanan (scope full) ─────────────────────────

const WATCHED_UNITS = ['nginx', 'ssh', 'fail2ban', 'pm2-root', 'cloudflared', '9remote', 'smart-backend', 'smart-tunnel'];

async function collectServices() {
	if (!IS_LINUX) return { available: false };
	return cached('services', 10_000, async () => {
		const units = await Promise.all(
			WATCHED_UNITS.map(async (u) => {
				const out = (await run('systemctl', ['is-active', u], 2000))?.trim();
				return { name: u, status: out || 'unknown' };
			}),
		);
		let pm2: unknown[] | null = null;
		const raw = await run('pm2', ['jlist'], 5000);
		if (raw) {
			try {
				const arr = JSON.parse(raw.slice(raw.indexOf('[')));
				pm2 = arr.map((p: any) => ({
					name: p.name,
					status: p.pm2_env?.status,
					restarts: p.pm2_env?.restart_time,
					uptimeSeconds: p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000) : null,
					cpuPercent: p.monit?.cpu,
					memoryBytes: p.monit?.memory,
				}));
			} catch {
				pm2 = null;
			}
		}
		return { available: true, systemd: units, pm2 };
	});
}

async function collectMongo() {
	const conn = mongoose.connection;
	const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
	const out: Record<string, unknown> = { state: states[conn.readyState] || 'unknown' };
	if (conn.readyState !== 1 || !conn.db) return out;
	try {
		const t0 = process.hrtime.bigint();
		await conn.db.admin().ping();
		out.pingMs = round(Number(process.hrtime.bigint() - t0) / 1e6, 1);
	} catch {
		/* ping gagal */
	}
	try {
		const s: any = await cached('mongo-stats', 30_000, () => conn.db!.command({ dbStats: 1 }));
		out.database = {
			collections: s.collections,
			objects: s.objects,
			dataSizeBytes: s.dataSize,
			storageSizeBytes: s.storageSize,
			indexSizeBytes: s.indexSize,
		};
	} catch {
		/* tidak ada izin dbStats */
	}
	return out;
}

async function collectSecurity() {
	if (!IS_LINUX) return { available: false };
	return cached('security', 15_000, async () => {
		const jails: Record<string, { currentlyBanned: number; totalBanned: number } | null> = {};
		for (const j of ['sshd', 'recidive']) {
			const out = await run('fail2ban-client', ['status', j], 3000);
			jails[j] = out
				? {
						currentlyBanned: Number(out.match(/Currently banned:\s*(\d+)/)?.[1] || 0),
						totalBanned: Number(out.match(/Total banned:\s*(\d+)/)?.[1] || 0),
				  }
				: null;
		}
		return { available: true, fail2ban: jails, pendingReboot: fs.existsSync('/var/run/reboot-required') };
	});
}

// ───────────────────────── Riwayat (ring buffer) + health ─────────────────────────

type HistoryPoint = {
	t: number;
	cpu: number;
	memPct: number;
	load1: number;
	rxBps: number;
	txBps: number;
	diskReadBps: number;
	diskWriteBps: number;
};
const HISTORY_MAX = 720; // 1 jam @ 5 detik
const history: HistoryPoint[] = [];
let samplerStarted = false;

export function startMonitorSampler(): void {
	if (samplerStarted) return;
	samplerStarted = true;
	const tick = async () => {
		try {
			const [cpu, mem, netw, dio] = await Promise.all([
				sampleCpu(),
				collectMemory(),
				collectNetwork('basic'),
				collectDiskIo(),
			]);
			const devs: any[] = (dio as any).devices || [];
			history.push({
				t: Date.now(),
				cpu: cpu?.total.usagePercent ?? 0,
				memPct: mem.usedPercent,
				load1: round(os.loadavg()[0], 2),
				rxBps: (netw as any).totalRxBytesPerSec ?? 0,
				txBps: (netw as any).totalTxBytesPerSec ?? 0,
				diskReadBps: devs.reduce((s, d) => s + (d.readBytesPerSec || 0), 0),
				diskWriteBps: devs.reduce((s, d) => s + (d.writeBytesPerSec || 0), 0),
			});
			if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
		} catch {
			/* sampler tidak boleh menjatuhkan server */
		}
	};
	void tick();
	setInterval(tick, 5000).unref();
}

export function getHistory(minutes = 10) {
	const since = Date.now() - Math.min(60, Math.max(1, minutes)) * 60_000;
	const points = history.filter((p) => p.t >= since);
	return {
		intervalSeconds: 5,
		count: points.length,
		points: points.map((p) => ({ ...p, time: new Date(p.t).toISOString() })),
	};
}

type Alert = { level: 'warn' | 'crit' | 'info'; code: string; message: string };

async function collectHealth() {
	const [cpu, mem, disk, app] = await Promise.all([collectCpu(), collectMemory(), collectDisk(), collectApp()]);
	const alerts: Alert[] = [];
	const recent = history.slice(-12);
	const cpuAvg = recent.length ? recent.reduce((s, p) => s + p.cpu, 0) / recent.length : cpu.usage?.usagePercent ?? 0;
	if (cpuAvg > 97) alerts.push({ level: 'crit', code: 'CPU_SATURATED', message: `CPU rata-rata 1 menit ${round(cpuAvg)}%` });
	else if (cpuAvg > 90) alerts.push({ level: 'warn', code: 'CPU_HIGH', message: `CPU rata-rata 1 menit ${round(cpuAvg)}%` });
	if (mem.usedPercent > 95) alerts.push({ level: 'crit', code: 'MEM_CRITICAL', message: `RAM terpakai ${mem.usedPercent}%` });
	else if (mem.usedPercent > 85) alerts.push({ level: 'warn', code: 'MEM_HIGH', message: `RAM terpakai ${mem.usedPercent}%` });
	if (!mem.swap.configured && mem.usedPercent > 75) alerts.push({ level: 'info', code: 'NO_SWAP', message: 'Swap tidak dikonfigurasi; risiko OOM saat RAM penuh' });
	for (const v of disk.volumes) {
		if (v.usedPercent > 95) alerts.push({ level: 'crit', code: 'DISK_FULL', message: `${v.mount} terpakai ${v.usedPercent}%` });
		else if (v.usedPercent > 85) alerts.push({ level: 'warn', code: 'DISK_HIGH', message: `${v.mount} terpakai ${v.usedPercent}%` });
	}
	const cores = Math.max(1, os.cpus().length);
	const l1 = os.loadavg()[0];
	if (l1 > cores * 3) alerts.push({ level: 'crit', code: 'LOAD_CRITICAL', message: `Load ${round(l1, 2)} untuk ${cores} core` });
	else if (l1 > cores * 1.5) alerts.push({ level: 'warn', code: 'LOAD_HIGH', message: `Load ${round(l1, 2)} untuk ${cores} core` });
	if ((cpu.usage?.iowaitPercent ?? 0) > 30) alerts.push({ level: 'warn', code: 'IOWAIT_HIGH', message: `I/O wait ${cpu.usage?.iowaitPercent}%` });
	if ((cpu.usage?.stealPercent ?? 0) > 10) alerts.push({ level: 'warn', code: 'CPU_STEAL', message: `CPU steal ${cpu.usage?.stealPercent}% (host berbagi sumber daya)` });
	if (app.eventLoopDelayMs.p99 > 200) alerts.push({ level: 'warn', code: 'EVENT_LOOP_LAG', message: `Event loop lag p99 ${app.eventLoopDelayMs.p99} ms` });
	const status = alerts.some((a) => a.level === 'crit') ? 'critical' : alerts.some((a) => a.level === 'warn') ? 'warning' : 'ok';
	return { status, alerts };
}

// ───────────────────────── Registry section ─────────────────────────

export type SectionOptions = { process?: ProcessQuery };
type SectionDef = { scope: MonitorScope; description: string; run: (scope: MonitorScope, opts: SectionOptions) => Promise<unknown> };

export const SECTIONS: Record<string, SectionDef> = {
	system: { scope: 'basic', description: 'OS, kernel, virtualisasi, uptime, waktu boot, jumlah proses, open files', run: (s) => collectSystem(s) },
	cpu: { scope: 'basic', description: 'Model, core, MHz, pemakaian total & per-core, iowait/steal, load average, PSI', run: () => collectCpu() },
	memory: { scope: 'basic', description: 'RAM, swap, cache/buffer, batas container', run: () => collectMemory() },
	disk: { scope: 'basic', description: 'Kapasitas & pemakaian per volume, inode', run: () => collectDisk() },
	diskio: { scope: 'basic', description: 'Throughput, IOPS, dan busy% per perangkat disk', run: () => collectDiskIo() },
	network: { scope: 'basic', description: 'Per-interface byte/paket/error dan kecepatan per detik', run: (s) => collectNetwork(s) },
	connections: { scope: 'basic', description: 'Koneksi TCP per state, soket UDP (full: port yang listen)', run: (s) => collectConnections(s) },
	gpu: { scope: 'basic', description: 'GPU NVIDIA bila ada (utilisasi, VRAM, suhu, daya)', run: () => collectGpu() },
	latency: { scope: 'basic', description: 'Latensi TCP ke 1.1.1.1 & 8.8.8.8 dan waktu DNS', run: () => collectLatency() },
	app: { scope: 'basic', description: 'Proses aplikasi Node: memori heap, CPU time, event-loop lag', run: () => collectApp() },
	health: { scope: 'basic', description: 'Status keseluruhan (ok/warning/critical) beserta daftar peringatan', run: () => collectHealth() },
	processes: { scope: 'full', description: 'Daftar proses ala Task Manager (CPU, RAM, thread, user, umur)', run: (_s, o) => collectProcesses(o.process) },
	services: { scope: 'full', description: 'Status layanan systemd penting dan aplikasi PM2', run: () => collectServices() },
	mongodb: { scope: 'full', description: 'Status koneksi, ping, dan ukuran database MongoDB', run: () => collectMongo() },
	security: { scope: 'full', description: 'Ringkasan fail2ban dan status reboot tertunda', run: () => collectSecurity() },
};

export const SECTION_NAMES = Object.keys(SECTIONS);

export function allowedSections(scope: MonitorScope): string[] {
	return SECTION_NAMES.filter((n) => scope === 'full' || SECTIONS[n].scope === 'basic');
}

export async function collectSections(names: string[], scope: MonitorScope, opts: SectionOptions = {}) {
	const entries = await Promise.all(
		names.map(async (n) => {
			try {
				return [n, await SECTIONS[n].run(scope, opts)] as const;
			} catch (err) {
				return [n, { error: 'UNAVAILABLE', message: err instanceof Error ? err.message : 'gagal membaca' }] as const;
			}
		}),
	);
	return Object.fromEntries(entries);
}

export async function collectSummary(scope: MonitorScope) {
	const [system, cpu, mem, disk, netw, health] = await Promise.all([
		collectSystem(scope),
		collectCpu(),
		collectMemory(),
		collectDisk(),
		collectNetwork(scope),
		collectHealth(),
	]);
	const root = disk.volumes.find((v) => v.mount === '/') || disk.volumes[0];
	return {
		status: health.status,
		alerts: health.alerts,
		uptimeSeconds: system.uptimeSeconds,
		cpu: { model: cpu.model, cores: cpu.logicalCores, usagePercent: cpu.usage?.usagePercent ?? null, load1: cpu.loadAverage.m1 },
		memory: { totalBytes: mem.totalBytes, usedBytes: mem.usedBytes, usedPercent: mem.usedPercent, swapUsedPercent: mem.swap.usedPercent },
		disk: root ? { mount: root.mount, totalBytes: root.totalBytes, usedBytes: root.usedBytes, usedPercent: root.usedPercent } : null,
		network: { rxBytesPerSec: (netw as any).totalRxBytesPerSec ?? null, txBytesPerSec: (netw as any).totalTxBytesPerSec ?? null },
	};
}

// ───────────────────────── Benchmark (sesuai permintaan) ─────────────────────────

const BENCH_WORKER = `
const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const end = Date.now() + workerData.ms;
const buf = crypto.randomBytes(1 << 20);
let hashed = 0;
while (Date.now() < end) { crypto.createHash('sha256').update(buf).digest(); hashed++; }
let sieveOps = 0; const t1 = Date.now();
while (Date.now() - t1 < 400) { const n = 200000; const s = new Uint8Array(n + 1); for (let i = 2; i * i <= n; i++) if (!s[i]) for (let j = i * i; j <= n; j += i) s[j] = 1; sieveOps++; }
const a = Buffer.alloc(32 << 20, 1), b = Buffer.alloc(32 << 20); let copied = 0; const t2 = Date.now();
while (Date.now() - t2 < 400) { a.copy(b); copied += a.length; }
parentPort.postMessage({ sha256MBps: hashed * 1 / (workerData.ms / 1000), sieveRunsPerSec: sieveOps / 0.4, memcpyMBps: copied / 1048576 / 0.4 });
`;

function runWorker(ms: number): Promise<{ sha256MBps: number; sieveRunsPerSec: number; memcpyMBps: number }> {
	return new Promise((resolve, reject) => {
		const w = new Worker(BENCH_WORKER, { eval: true, workerData: { ms } });
		w.once('message', resolve);
		w.once('error', reject);
	});
}

async function benchDisk() {
	const file = path.join(os.tmpdir(), `hmps-bench-${crypto.randomBytes(6).toString('hex')}`);
	const chunk = crypto.randomBytes(1 << 20);
	const MB = 64;
	try {
		const fh = await fs.promises.open(file, 'w');
		let t = process.hrtime.bigint();
		for (let i = 0; i < MB; i++) await fh.write(chunk);
		await fh.sync();
		const writeSec = Number(process.hrtime.bigint() - t) / 1e9;
		const small = Buffer.alloc(4096, 7);
		t = process.hrtime.bigint();
		const N = 100;
		for (let i = 0; i < N; i++) {
			await fh.write(small, 0, 4096, i * 4096);
			await fh.datasync();
		}
		const syncMs = Number(process.hrtime.bigint() - t) / 1e6 / N;
		await fh.close();
		t = process.hrtime.bigint();
		const rh = await fs.promises.open(file, 'r');
		const rbuf = Buffer.alloc(1 << 20);
		for (let i = 0; i < MB; i++) await rh.read(rbuf, 0, rbuf.length, i * rbuf.length);
		await rh.close();
		const readSec = Number(process.hrtime.bigint() - t) / 1e9;
		return {
			sequentialWriteMBps: round(MB / writeSec, 1),
			sequentialReadMBps: round(MB / readSec, 1),
			fsync4kLatencyMs: round(syncMs, 2),
			note: 'Baca bisa terbantu page cache, tulis sudah di-fsync.',
		};
	} finally {
		fs.promises.unlink(file).catch(() => {});
	}
}

async function benchNet() {
	try {
		const t = process.hrtime.bigint();
		const res = await fetch('https://speed.cloudflare.com/__down?bytes=10000000', { signal: AbortSignal.timeout(15000) });
		const buf = await res.arrayBuffer();
		const sec = Number(process.hrtime.bigint() - t) / 1e9;
		return { downloadMbps: round((buf.byteLength * 8) / 1e6 / sec, 1), bytes: buf.byteLength, source: 'speed.cloudflare.com' };
	} catch {
		return { error: 'Tes jaringan gagal' };
	}
}

let benchRunning = false;
let lastBench: { at: string; durationMs: number; result: unknown } | null = null;
let lastBenchAt = 0;
export const BENCH_MIN_INTERVAL_MS = 60_000;

export function getLastBench() {
	return lastBench;
}
export function benchCooldownSeconds(): number {
	return Math.max(0, Math.ceil((lastBenchAt + BENCH_MIN_INTERVAL_MS - Date.now()) / 1000));
}
export function isBenchRunning(): boolean {
	return benchRunning;
}

export async function runBenchmark(opts: { network?: boolean } = {}) {
	benchRunning = true;
	lastBenchAt = Date.now();
	const t0 = Date.now();
	try {
		const cores = Math.max(1, os.cpus().length);
		const single = await runWorker(1500);
		const multi = cores > 1 ? await Promise.all(Array.from({ length: Math.min(cores, 4) }, () => runWorker(1500))) : null;
		const disk = await benchDisk();
		const network = opts.network ? await benchNet() : undefined;
		const result = {
			cpu: {
				logicalCores: cores,
				singleThread: { sha256MBps: round(single.sha256MBps, 1), primeSieveRunsPerSec: round(single.sieveRunsPerSec, 1) },
				multiThread: multi
					? { threads: multi.length, sha256MBps: round(multi.reduce((s, r) => s + r.sha256MBps, 0), 1) }
					: null,
			},
			memory: { copyMBps: round(single.memcpyMBps, 1) },
			disk,
			...(network ? { network } : {}),
		};
		lastBench = { at: new Date().toISOString(), durationMs: Date.now() - t0, result };
		return lastBench;
	} finally {
		benchRunning = false;
	}
}
