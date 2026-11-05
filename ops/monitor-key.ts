/**
 * Kelola API key Server Monitor (hanya hash SHA-256 yang disimpan di database).
 *
 *   npx tsx ops/monitor-key.ts create "Nama teman" [--scope basic|full] [--days 90] [--rate 120]
 *   npx tsx ops/monitor-key.ts list
 *   npx tsx ops/monitor-key.ts revoke <keyId>
 *
 * Jalankan di mesin yang `.env`-nya menunjuk database yang dipakai server (produksi: di server).
 * Key asli hanya dicetak SEKALI saat `create`.
 */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB, MonitorApiKey } from '../db/mongodb';
import { hashMonitorKey } from '../server/routes/monitor';

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
	const [cmd, ...rest] = process.argv.slice(2);
	if (!['create', 'list', 'revoke'].includes(cmd || '')) {
		console.log('Pemakaian: create "<nama>" [--scope basic|full] [--days N] [--rate N] | list | revoke <keyId>');
		process.exit(1);
	}
	await connectDB();
	try {
		if (cmd === 'create') {
			const name = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
			if (!name) throw new Error('Nama key wajib diisi.');
			const scope = (flag(rest, 'scope') || 'basic') as 'basic' | 'full';
			if (!['basic', 'full'].includes(scope)) throw new Error('--scope harus basic atau full');
			const days = flag(rest, 'days') ? parseInt(flag(rest, 'days')!, 10) : 0;
			const rate = flag(rest, 'rate') ? parseInt(flag(rest, 'rate')!, 10) : 120;
			const keyId = crypto.randomBytes(4).toString('hex');
			const secret = crypto.randomBytes(32).toString('base64url');
			const key = `hmon_${keyId}_${secret}`;
			await MonitorApiKey.create({
				keyId,
				keyHash: hashMonitorKey(key),
				name,
				scope,
				rateLimitPerMin: rate,
				expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
				createdBy: 'ops/monitor-key.ts',
			});
			console.log(`\nKey dibuat untuk "${name}" (scope: ${scope}, id: ${keyId}, rate: ${rate}/menit${days > 0 ? `, kedaluwarsa ${days} hari` : ', tanpa kedaluwarsa'})`);
			console.log('SIMPAN SEKARANG — tidak akan ditampilkan lagi:\n');
			console.log(key + '\n');
		} else if (cmd === 'list') {
			const keys: any[] = await MonitorApiKey.find().sort({ createdAt: -1 }).lean();
			if (!keys.length) console.log('Belum ada key.');
			for (const k of keys) {
				const state = k.revokedAt ? 'DICABUT' : k.expiresAt && new Date(k.expiresAt) < new Date() ? 'KEDALUWARSA' : 'aktif';
				console.log(`${k.keyId}  ${state.padEnd(11)} ${k.scope.padEnd(5)} ${String(k.requestCount).padStart(7)} req  terakhir: ${k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : '-'}  "${k.name}"`);
			}
		} else {
			const keyId = rest[0];
			if (!keyId) throw new Error('keyId wajib diisi.');
			const r = await MonitorApiKey.updateOne({ keyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
			console.log(r.modifiedCount ? `Key ${keyId} dicabut.` : `Key ${keyId} tidak ditemukan atau sudah dicabut.`);
		}
	} finally {
		await mongoose.disconnect();
	}
}

main().catch((e) => {
	console.error('Gagal:', e instanceof Error ? e.message : e);
	process.exit(1);
});
