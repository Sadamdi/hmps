/**
 * Sumber karya non-repo yang dikenali (desain, game, 3D, animasi, video, dokumen, dll.).
 * Dipakai editor "Mulai dari link" untuk menebak kategori, label tautan, dan apakah bisa di-embed.
 * Link dari situs lain tetap bisa dipakai: metadata (judul, deskripsi, gambar) diambil dari Open Graph.
 */
export interface KaryaSourceDef {
	id: string;
	label: string;
	hosts: RegExp;
	categories: string[];
	tags: string[];
	linkLabel: string;
}

export const KARYA_SOURCES: KaryaSourceDef[] = [
	{ id: 'figma', label: 'Figma', hosts: /(^|\.)figma\.com$/i, categories: ['uiux'], tags: ['figma', 'ui/ux'], linkLabel: 'Desain Figma' },
	{ id: 'behance', label: 'Behance', hosts: /(^|\.)behance\.net$/i, categories: ['uiux', 'multimedia'], tags: ['ui/ux'], linkLabel: 'Lihat di Behance' },
	{ id: 'dribbble', label: 'Dribbble', hosts: /(^|\.)dribbble\.com$/i, categories: ['uiux'], tags: ['ui/ux'], linkLabel: 'Lihat di Dribbble' },
	{ id: 'canva', label: 'Canva', hosts: /(^|\.)canva\.com$/i, categories: ['uiux', 'multimedia'], tags: ['canva'], linkLabel: 'Desain Canva' },
	{ id: 'itch', label: 'itch.io', hosts: /(^|\.)itch\.io$/i, categories: ['game'], tags: ['2d game'], linkLabel: 'Main di itch.io' },
	{ id: 'gamejolt', label: 'Game Jolt', hosts: /(^|\.)gamejolt\.com$/i, categories: ['game'], tags: [], linkLabel: 'Main di Game Jolt' },
	{ id: 'roblox', label: 'Roblox', hosts: /(^|\.)roblox\.com$/i, categories: ['game'], tags: ['roblox'], linkLabel: 'Main di Roblox' },
	{ id: 'playstore', label: 'Google Play', hosts: /^play\.google\.com$/i, categories: ['mobile'], tags: ['android'], linkLabel: 'Google Play' },
	{ id: 'appstore', label: 'App Store', hosts: /^apps\.apple\.com$/i, categories: ['mobile'], tags: ['ios'], linkLabel: 'App Store' },
	{ id: 'artstation', label: 'ArtStation', hosts: /(^|\.)artstation\.com$/i, categories: ['multimedia'], tags: ['blender'], linkLabel: 'Lihat di ArtStation' },
	{ id: 'sketchfab', label: 'Sketchfab', hosts: /(^|\.)sketchfab\.com$/i, categories: ['multimedia', 'game'], tags: ['3d game', 'blender'], linkLabel: 'Model 3D (Sketchfab)' },
	{ id: 'youtube', label: 'YouTube', hosts: /(^|\.)(youtube\.com|youtu\.be)$/i, categories: ['multimedia'], tags: [], linkLabel: 'Video' },
	{ id: 'vimeo', label: 'Vimeo', hosts: /(^|\.)vimeo\.com$/i, categories: ['multimedia'], tags: [], linkLabel: 'Video (Vimeo)' },
	{ id: 'codepen', label: 'CodePen', hosts: /(^|\.)codepen\.io$/i, categories: ['web'], tags: ['html', 'css', 'javascript'], linkLabel: 'Demo CodePen' },
	{ id: 'huggingface', label: 'Hugging Face', hosts: /(^|\.)(huggingface\.co|hf\.space)$/i, categories: ['ai-data'], tags: ['hugging face'], linkLabel: 'Demo Hugging Face' },
	{ id: 'kaggle', label: 'Kaggle', hosts: /(^|\.)kaggle\.com$/i, categories: ['ai-data'], tags: ['data science', 'jupyter'], linkLabel: 'Notebook Kaggle' },
	{ id: 'colab', label: 'Google Colab', hosts: /^colab\.research\.google\.com$/i, categories: ['ai-data'], tags: ['jupyter', 'python'], linkLabel: 'Notebook Colab' },
	{ id: 'notion', label: 'Notion', hosts: /(^|\.)(notion\.site|notion\.so)$/i, categories: [], tags: [], linkLabel: 'Dokumentasi (Notion)' },
	{ id: 'gdocs', label: 'Google Drive', hosts: /^(docs|drive)\.google\.com$/i, categories: [], tags: [], linkLabel: 'Dokumen' },
	{ id: 'medium', label: 'Medium', hosts: /(^|\.)medium\.com$/i, categories: ['riset'], tags: [], linkLabel: 'Artikel (Medium)' },
	{ id: 'scholar', label: 'Jurnal / paper', hosts: /(^|\.)(researchgate\.net|scholar\.google\.com|garuda\.kemdikbud\.go\.id|arxiv\.org|ejournal\.[a-z.]+)$/i, categories: ['riset'], tags: [], linkLabel: 'Paper' },
	{ id: 'vercel', label: 'Situs web', hosts: /(^|\.)(vercel\.app|netlify\.app|github\.io|pages\.dev|web\.app)$/i, categories: ['web'], tags: [], linkLabel: 'Demo langsung' },
];

export function karyaSourceOf(url: string): KaryaSourceDef | null {
	try {
		const h = new URL(url).hostname.toLowerCase();
		return KARYA_SOURCES.find((s) => s.hosts.test(h)) || null;
	} catch {
		return null;
	}
}
