import {
	Berita as Article,
	Library,
	Organization,
	Settings,
} from '../../db/mongodb';

// Tool definitions untuk Gemini function calling
export const AI_TOOLS = [
	{
		name: 'get_visi_misi',
		description:
			'Ambil visi dan misi terbaru organisasi Himatif Encoder dari database. Gunakan saat user bertanya tentang visi, misi, atau tujuan Himatif Encoder.',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
	{
		name: 'search_articles',
		description:
			'Cari dan ambil daftar berita Himatif Encoder dari database. Bisa filter berdasarkan kata kunci judul. Gunakan saat user bertanya tentang berita atau tulisan Himatif Encoder.',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description:
						'Kata kunci pencarian pada judul artikel (opsional). Biarkan kosong untuk mendapatkan semua artikel.',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal artikel yang dikembalikan. Default 10.',
				},
			},
			required: [],
		},
	},
	{
		name: 'get_article_detail',
		description:
			'Ambil detail lengkap satu berita berdasarkan ID atau slug. Gunakan setelah search_articles untuk mendapatkan konten penuh berita.',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'ID MongoDB atau slug dari artikel yang ingin diambil.',
				},
			},
			required: ['id'],
		},
	},
	{
		name: 'get_library_items',
		description:
			'Ambil daftar media (foto/video kegiatan) dari library Himatif Encoder. Gunakan saat user bertanya tentang dokumentasi kegiatan, foto, atau video Himatif Encoder.',
		parameters: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: ['photo', 'video', 'all'],
					description:
						'Filter tipe media: "photo" untuk foto, "video" untuk video, "all" untuk semua. Default "all".',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal item yang dikembalikan. Default 10.',
				},
			},
			required: [],
		},
	},
	{
		name: 'get_organization_structure',
		description:
			'Ambil struktur organisasi Himatif Encoder termasuk ketua, wakil, divisi, dan kepala divisi dari database. Gunakan saat user bertanya tentang pengurus, struktur organisasi, atau anggota Himatif Encoder.',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
];

// Executor untuk menjalankan tool call dari Gemini
export async function executeToolCall(
	name: string,
	args: Record<string, unknown>
): Promise<Record<string, unknown>> {
	try {
		switch (name) {
			case 'get_visi_misi': {
				const settings = await Settings.findOne()
					.select('siteName siteTagline visionMission aboutUs')
					.lean() as Record<string, unknown> | null;
				return {
					siteName: (settings?.siteName as string) ?? 'Himatif Encoder',
					siteTagline: (settings?.siteTagline as string) ?? '',
					visionMission: (settings?.visionMission as string) ?? 'Data tidak tersedia',
					aboutUs: (settings?.aboutUs as string) ?? '',
				};
			}

			case 'search_articles': {
				const keyword = args.keyword as string | undefined;
				const limit = (args.limit as number) || 10;
				const query: Record<string, unknown> = { published: true };
				if (keyword && keyword.trim()) {
					query.title = { $regex: keyword.trim(), $options: 'i' };
				}
				const articles = await Article.find(query)
					.select('title excerpt author createdAt tags slug _id')
					.sort({ createdAt: -1 })
					.limit(Math.min(limit, 20))
					.lean();
				return {
					count: articles.length,
					articles: articles.map((a) => ({
						id: a._id?.toString(),
						title: a.title,
						excerpt: a.excerpt,
						author: a.author,
						tags: a.tags,
						slug: a.slug,
						createdAt: a.createdAt,
					})),
				};
			}

			case 'get_article_detail': {
				const id = args.id as string;
				if (!id) return { error: 'ID artikel diperlukan' };

				let article = null;
				// Coba cari by slug dulu, lalu by _id jika gagal
				article = await Article.findOne({ slug: id, published: true })
					.select('title content excerpt author createdAt tags slug')
					.lean();

				if (!article) {
					try {
						article = await Article.findById(id)
							.select('title content excerpt author createdAt tags slug')
							.lean();
					} catch {
						// Invalid ObjectId format, artikel tidak ditemukan
					}
				}

				if (!article) {
					return { error: `Artikel dengan ID/slug "${id}" tidak ditemukan` };
				}
				return {
					id: (article as any)._id?.toString(),
					title: (article as any).title,
					content: (article as any).content,
					excerpt: (article as any).excerpt,
					author: (article as any).author,
					tags: (article as any).tags,
					slug: (article as any).slug,
					createdAt: (article as any).createdAt,
				};
			}

			case 'get_library_items': {
				const mediaType = args.type as string | undefined;
				const limit = (args.limit as number) || 10;
				const query: Record<string, unknown> = {};
				if (mediaType && mediaType !== 'all') {
					query.type = mediaType;
				}
				const items = await Library.find(query)
					.select('title description fullDescription type createdAt _id')
					.sort({ createdAt: -1 })
					.limit(Math.min(limit, 20))
					.lean();
				return {
					count: items.length,
					items: items.map((item) => ({
						id: (item as any)._id?.toString(),
						title: (item as any).title,
						description: (item as any).description,
						fullDescription: (item as any).fullDescription,
						type: (item as any).type,
						createdAt: (item as any).createdAt,
					})),
				};
			}

			case 'get_organization_structure': {
				const settings = await Settings.findOne()
					.select(
						'chairpersonName chairpersonTitle chairpersonPhoto viceChairpersonName viceChairpersonTitle viceChairpersonPhoto divisionNames divisionHeads siteName'
					)
					.lean();

				const members = await Organization.find()
					.select('name position period imageUrl')
					.sort({ createdAt: -1 })
					.limit(50)
					.lean();

				return {
					leadership: {
						chair: {
							name: (settings as any)?.chairpersonName ?? '',
							title: (settings as any)?.chairpersonTitle ?? 'Ketua Himpunan',
						},
						viceChair: {
							name: (settings as any)?.viceChairpersonName ?? '',
							title: (settings as any)?.viceChairpersonTitle ?? 'Wakil Ketua',
						},
					},
					divisions: (settings as any)?.divisionNames ?? {},
					divisionHeads: (settings as any)?.divisionHeads ?? {},
					members: members.map((m) => ({
						name: (m as any).name,
						position: (m as any).position,
						period: (m as any).period,
					})),
				};
			}

			default:
				return { error: `Tool "${name}" tidak dikenali` };
		}
	} catch (error) {
		console.error(`Error executing tool "${name}":`, error);
		return {
			error: `Terjadi kesalahan saat mengambil data: ${(error as Error).message}`,
		};
	}
}
