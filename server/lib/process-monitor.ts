/**
 * Process monitor ala Task Manager: CPU, RAM, disk I/O, socket per proses dari /proc (Linux).
 *
 * CPU % dan disk rate dihitung dari selisih dua sampel (sampel sebelumnya disimpan di memori),
 * jadi panggilan pertama mengembalikan 0 untuk nilai berbasis laju. Linux tidak mencatat trafik
 * jaringan per proses tanpa eBPF/nethogs → per proses hanya jumlah socket terbuka; laju jaringan
 * total diambil dari /proc/net/dev.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const CLK_TCK = 100; // USER_HZ standar Linux
const PAGE_SIZE = 4096;

export interface ProcessRow {
	pid: number;
	name: string;
	service: string; // nama PM2 bila ada, selain itu nama proses
	command: string;
	user: string;
	state: string;
	threads: number;
	cpu: number; // % dari total kapasitas CPU (semua core)
	memBytes: number;
	memPercent: number;
	diskReadRate: number; // B/s
	diskWriteRate: number; // B/s
	diskPercent: number; // porsi dari total I/O semua proses
	sockets: number;
	uptimeSec: number;
}

export interface ProcessSnapshot {
	supported: boolean;
	sampledAt: number;
	intervalSec: number;
	cores: number;
	memTotal: number;
	totals: { cpu: number; memBytes: number; diskReadRate: number; diskWriteRate: number; netRxRate: number; netTxRate: number; processCount: number };
	processes: ProcessRow[];
}

type Prev = { t: number; ticks: Map<number, number>; io: Map<number, { r: number; w: number }>; net: { rx: number; tx: number } | null };
let prev: Prev | null = null;
const userCache = new Map<number, string>();

function read(p: string): string | null {
	try {
		return fs.readFileSync(p, 'utf8');
	} catch {
		return null;
	}
}

function uidName(uid: number): string {
	if (userCache.has(uid)) return userCache.get(uid)!;
	const line = (read('/etc/passwd') || '').split('\n').find((l) => l.split(':')[2] === String(uid));
	const name = line ? line.split(':')[0] : String(uid);
	userCache.set(uid, name);
	return name;
}

function netTotals(): { rx: number; tx: number } | null {
	const txt = read('/proc/net/dev');
	if (!txt) return null;
	let rx = 0;
	let tx = 0;
	for (const line of txt.split('\n').slice(2)) {
		const [iface, rest] = line.split(':');
		if (!rest || iface.trim() === 'lo') continue;
		const f = rest.trim().split(/\s+/).map(Number);
		rx += f[0] || 0;
		tx += f[8] || 0;
	}
	return { rx, tx };
}

/** PID → nama app PM2, dari file `<PM2_HOME>/pids/<nama>-<id>.pid`. */
function pm2PidMap(): Map<number, string> {
	const map = new Map<number, string>();
	const dir = path.join(process.env.PM2_HOME || path.join(os.homedir(), '.pm2'), 'pids');
	try {
		for (const f of fs.readdirSync(dir)) {
			const m = /^(.+)-\d+\.pid$/.exec(f);
			const pid = Number(read(path.join(dir, f))?.trim());
			if (m && pid) map.set(pid, m[1]);
		}
	} catch {
		/* PM2 tidak dipakai */
	}
	return map;
}

/** Nama yang mudah dibaca: untuk interpreter (node/python/…) pakai nama skripnya. */
function friendlyName(comm: string, argv: string[]): string {
	// process.title yang diganti (mis. "PM2 v6: God Daemon (/root/.pm2)") → tampilkan apa adanya
	if (argv.length === 1 && argv[0].includes(' ')) return argv[0].slice(0, 60);
	const exe = path.basename(argv[0] || comm);
	if (/^(node|nodejs|python\d*(\.\d+)?|bun|deno|php|ruby|java)$/.test(exe)) {
		const script = argv.slice(1).find((a) => !a.startsWith('-'));
		if (script) {
			const parts = script.split('/').filter(Boolean);
			const base = parts[parts.length - 1] || script;
			// .../node_modules/<paket>/dist/x.js → nama paket lebih informatif
			const nm = parts.lastIndexOf('node_modules');
			return nm >= 0 && parts[nm + 1] ? `${parts[nm + 1]} (${exe})` : `${base} (${exe})`;
		}
	}
	return argv.length ? exe : comm;
}

function countSockets(pid: number): number {
	try {
		let n = 0;
		for (const fd of fs.readdirSync(`/proc/${pid}/fd`)) {
			try {
				if (fs.readlinkSync(`/proc/${pid}/fd/${fd}`).startsWith('socket:')) n++;
			} catch {
				/* fd tertutup di tengah jalan */
			}
		}
		return n;
	} catch {
		return 0;
	}
}

export function getProcessSnapshot(): ProcessSnapshot {
	const now = Date.now();
	const cores = os.cpus().length || 1;
	const memTotal = os.totalmem();
	const empty: ProcessSnapshot = {
		supported: false,
		sampledAt: now,
		intervalSec: 0,
		cores,
		memTotal,
		totals: { cpu: 0, memBytes: 0, diskReadRate: 0, diskWriteRate: 0, netRxRate: 0, netTxRate: 0, processCount: 0 },
		processes: [],
	};
	if (process.platform !== 'linux' || !fs.existsSync('/proc/self/stat')) return empty;

	const bootUptime = Number((read('/proc/uptime') || '0').split(' ')[0]) || 0;
	const dt = prev ? (now - prev.t) / 1000 : 0;
	const ticks = new Map<number, number>();
	const ioMap = new Map<number, { r: number; w: number }>();
	const rows: ProcessRow[] = [];
	const pm2 = pm2PidMap();

	for (const entry of fs.readdirSync('/proc')) {
		if (!/^\d+$/.test(entry)) continue;
		const pid = Number(entry);
		const stat = read(`/proc/${pid}/stat`);
		if (!stat) continue;
		// comm bisa mengandung spasi/kurung → potong di ")" terakhir
		const close = stat.lastIndexOf(')');
		const name = stat.slice(stat.indexOf('(') + 1, close);
		const f = stat.slice(close + 2).split(' ');
		// f[0]=state, f[11]=utime, f[12]=stime, f[17]=num_threads, f[19]=starttime, f[21]=rss(pages)
		const total = Number(f[11]) + Number(f[12]);
		ticks.set(pid, total);
		const rssBytes = Number(f[21]) * PAGE_SIZE;
		if (rssBytes <= 0 && name.startsWith('kworker')) continue;

		const io = read(`/proc/${pid}/io`);
		let r = 0;
		let w = 0;
		if (io) {
			r = Number(/read_bytes:\s*(\d+)/.exec(io)?.[1] || 0);
			w = Number(/write_bytes:\s*(\d+)/.exec(io)?.[1] || 0);
			ioMap.set(pid, { r, w });
		}

		const status = read(`/proc/${pid}/status`) || '';
		const uid = Number(/Uid:\s*(\d+)/.exec(status)?.[1] || 0);
		const argv = (read(`/proc/${pid}/cmdline`) || '').split('\0').filter(Boolean);
		const cmd = argv.join(' ');

		let cpu = 0;
		let rr = 0;
		let wr = 0;
		if (prev && dt > 0) {
			const pt = prev.ticks.get(pid);
			if (pt !== undefined) cpu = Math.max(0, ((total - pt) / CLK_TCK / dt / cores) * 100);
			const pio = prev.io.get(pid);
			if (pio) {
				rr = Math.max(0, (r - pio.r) / dt);
				wr = Math.max(0, (w - pio.w) / dt);
			}
		}

		rows.push({
			pid,
			name,
			service: pm2.get(pid) ? `${pm2.get(pid)} (pm2)` : friendlyName(name, argv),
			// batasi panjang; argumen bisa berisi path panjang
			command: cmd.slice(0, 200) || `[${name}]`,
			user: uidName(uid),
			state: f[0],
			threads: Number(f[17]) || 1,
			cpu: Math.round(cpu * 10) / 10,
			memBytes: rssBytes,
			memPercent: Math.round((rssBytes / memTotal) * 1000) / 10,
			diskReadRate: Math.round(rr),
			diskWriteRate: Math.round(wr),
			diskPercent: 0,
			sockets: 0,
			uptimeSec: Math.max(0, Math.round(bootUptime - Number(f[19]) / CLK_TCK)),
		});
	}

	const ioSum = rows.reduce((s, p) => s + p.diskReadRate + p.diskWriteRate, 0);
	for (const p of rows) p.diskPercent = ioSum > 0 ? Math.round(((p.diskReadRate + p.diskWriteRate) / ioSum) * 1000) / 10 : 0;
	// socket hanya dihitung untuk proses yang punya memori (hemat syscall)
	for (const p of rows) if (p.memBytes > 0) p.sockets = countSockets(p.pid);

	const net = netTotals();
	const netRxRate = prev?.net && net && dt > 0 ? Math.max(0, (net.rx - prev.net.rx) / dt) : 0;
	const netTxRate = prev?.net && net && dt > 0 ? Math.max(0, (net.tx - prev.net.tx) / dt) : 0;
	prev = { t: now, ticks, io: ioMap, net };

	return {
		supported: true,
		sampledAt: now,
		intervalSec: Math.round(dt * 10) / 10,
		cores,
		memTotal,
		totals: {
			cpu: Math.min(100, Math.round(rows.reduce((s, p) => s + p.cpu, 0) * 10) / 10),
			memBytes: rows.reduce((s, p) => s + p.memBytes, 0),
			diskReadRate: rows.reduce((s, p) => s + p.diskReadRate, 0),
			diskWriteRate: rows.reduce((s, p) => s + p.diskWriteRate, 0),
			netRxRate: Math.round(netRxRate),
			netTxRate: Math.round(netTxRate),
			processCount: rows.length,
		},
		processes: rows,
	};
}
