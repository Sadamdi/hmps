/**
 * Static audit for AI tool permission matrix.
 * Run: npx tsx ops/audit-ai-tools.ts
 */
import {
	getToolsForPermissions,
	isDashboardAiWriteAllowed,
	isDashboardTokoPath,
} from '../server/services/ai-tools';

const PUBLIC_TOOLS = 11;

const scenarios = [
	{ label: 'Guest public /', perms: [] as string[], path: '/' },
	{ label: 'Guest tenant public', perms: [] as string[], path: '/my-hmps/berita' },
	{
		label: 'Admin dashboard full',
		perms: [
			'dashboard.stats',
			'berita.view',
			'berita.create',
			'berita.edit',
			'berita.edit_others',
			'berita.publish',
			'events.view',
			'events.create',
			'events.edit',
			'events.edit_others',
			'events.publish',
			'library.view',
			'library.create',
			'library.edit',
			'library.edit_others',
			'library.publish',
			'toko.view',
			'toko.manage',
		],
		path: '/dashboard',
	},
	{
		label: 'Admin public (no write)',
		perms: ['berita.view', 'berita.create', 'berita.edit', 'berita.edit_others', 'berita.publish'],
		path: '/berita',
	},
	{
		label: 'Toko write dashboard (not toko page)',
		perms: ['toko.manage'],
		path: '/dashboard',
	},
	{
		label: 'Toko write dashboard/toko',
		perms: ['toko.manage'],
		path: '/dashboard/toko',
	},
];

let failed = 0;

console.log('=== AI Tools Permission Audit ===');
for (const s of scenarios) {
	const tools = getToolsForPermissions(s.perms, s.path);
	const names = tools.map((t) => t.name as string).sort();
	const writeTools = names.filter(
		(n) =>
			n.startsWith('create_') ||
			n.startsWith('update_') ||
			n.startsWith('delete_') ||
			n.startsWith('toggle_') ||
			n.startsWith('set_') ||
			n.startsWith('link_') ||
			n.startsWith('unlink_') ||
			n.startsWith('copy_') ||
			n.startsWith('sync_')
	);
	console.log(`\n${s.label}: ${tools.length} tools`);
	if (s.perms.length === 0 && tools.length !== PUBLIC_TOOLS) {
		console.log(`  FAIL: expected ${PUBLIC_TOOLS} public tools, got ${tools.length}`);
		failed++;
	}
	if (s.label.includes('public (no write)') && writeTools.length > 0) {
		console.log(`  FAIL: write tools on public path: ${writeTools.join(', ')}`);
		failed++;
	}
	if (
		s.label.includes('Toko write dashboard (not toko') &&
		writeTools.some((n) => n.includes('store'))
	) {
		console.log('  FAIL: store write without toko path');
		failed++;
	}
}

const guards = [
	['/dashboard/berita', isDashboardAiWriteAllowed('/dashboard/berita'), true],
	['/slug/dashboard', isDashboardAiWriteAllowed('/slug/dashboard'), true],
	['/berita', isDashboardAiWriteAllowed('/berita'), false],
	['/dashboard/toko', isDashboardTokoPath('/dashboard/toko'), true],
	['/slug/dashboard/toko/produk', isDashboardTokoPath('/slug/dashboard/toko/produk'), true],
	['/dashboard', isDashboardTokoPath('/dashboard'), false],
] as const;

for (const [path, actual, expected] of guards) {
	if (actual !== expected) failed++;
}

if (failed > 0) {
	console.error(`\nAudit FAILED (${failed} checks)`);
	process.exit(1);
}
console.log('\nAudit PASSED');
process.exit(0);
