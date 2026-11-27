/**
 * Notifikasi info kampus dari feed pengumuman (prodi-student-resources): beasiswa, PKL/magang, dan
 * pengumuman lain. Hanya item BARU dibanding sinkron sebelumnya yang dikirim; sinkron pertama (data lama
 * kosong) tidak mengirim apa pun agar tidak membanjiri pelanggan. Maks MAX_PER_TOPIC per topik; sisanya
 * diringkas menjadi satu notifikasi.
 */
import type { NotifEventType } from './notification-orchestrator';

type Ann = { title: string; url: string; source?: string; category?: string; excerpt?: string };
const MAX_PER_TOPIC = 3;
const PKL_RE = /\b(pkl|praktik kerja|praktek kerja|kerja praktik|magang|internship|intern)\b/i;

export function topicOf(a: Ann): NotifEventType {
	if (a.category === 'beasiswa' || /beasiswa|scholarship/i.test(a.title)) return 'info_scholarship';
	if (PKL_RE.test(`${a.title} ${a.excerpt || ''}`)) return 'info_internship';
	return 'info_announcement';
}

const LABEL: Record<string, string> = { info_scholarship: 'Info beasiswa', info_internship: 'Info PKL / magang', info_announcement: 'Pengumuman kampus' };

export async function notifyNewAnnouncements(before: Ann[], after: Ann[]): Promise<number> {
	if (!before?.length || !after?.length) return 0;
	const seen = new Set(before.map((a) => a.url || a.title));
	const fresh = after.filter((a) => !seen.has(a.url || a.title));
	if (!fresh.length) return 0;
	const { broadcastNotification } = await import('./notification-orchestrator');
	const byTopic = new Map<NotifEventType, Ann[]>();
	for (const a of fresh) byTopic.set(topicOf(a), [...(byTopic.get(topicOf(a)) || []), a]);
	let sent = 0;
	for (const [topic, items] of Array.from(byTopic.entries())) {
		const head = items.slice(0, MAX_PER_TOPIC);
		for (const a of head) {
			await broadcastNotification(topic, { userId: null as any, name: 'Info Kampus' } as any, {
				title: `${LABEL[topic]}: ${a.title}`.slice(0, 140),
				description: (a.excerpt || a.source || '').slice(0, 160),
				actionUrl: a.url && /^https?:\/\//.test(a.url) ? a.url : '/prodi',
				tag: `info-${topic}-${(a.url || a.title).slice(-40)}`,
			});
			sent++;
		}
		if (items.length > MAX_PER_TOPIC) {
			await broadcastNotification(topic, { userId: null as any, name: 'Info Kampus' } as any, {
				title: `${items.length - MAX_PER_TOPIC} ${LABEL[topic].toLowerCase()} lainnya`,
				description: 'Lihat semua di halaman Prodi → Info mahasiswa.',
				actionUrl: '/prodi',
				tag: `info-${topic}-more`,
			});
			sent++;
		}
	}
	return sent;
}
