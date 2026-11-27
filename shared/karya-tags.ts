import { languageDef } from './karya-languages';
/**
 * Taksonomi tag Karya TI + deteksi otomatis kategori/tag dari repo.
 *
 * Grup disusun dari kategori yang umum dipakai survei/ekosistem developer (bahasa, framework,
 * runtime, database, AI/LLM, cloud/DevOps, mobile, game, IoT, desain, keamanan) dan dipakai di:
 * - editor karya (saran tag per grup),
 * - halaman publik (filter + chip berwarna per grup),
 * - impor repo (isi otomatis kategori & tag).
 * Tag tetap bebas: mahasiswa boleh menulis tag di luar daftar ini.
 */

export type KaryaTagGroupId =
	| 'language'
	| 'frontend'
	| 'backend'
	| 'mobile'
	| 'runtime'
	| 'database'
	| 'ai'
	| 'data'
	| 'cloud'
	| 'game'
	| 'iot'
	| 'design'
	| 'security'
	| 'testing'
	| 'topic';

export const KARYA_TAG_GROUPS: { id: KaryaTagGroupId; label: string; tone: string }[] = [
	{ id: 'language', label: 'Bahasa pemrograman', tone: 'sky' },
	{ id: 'frontend', label: 'Frontend & UI', tone: 'violet' },
	{ id: 'backend', label: 'Backend & API', tone: 'emerald' },
	{ id: 'mobile', label: 'Mobile & cross-platform', tone: 'pink' },
	{ id: 'runtime', label: 'Runtime & platform', tone: 'lime' },
	{ id: 'database', label: 'Database & storage', tone: 'amber' },
	{ id: 'ai', label: 'AI, ML & LLM', tone: 'fuchsia' },
	{ id: 'data', label: 'Data & analitik', tone: 'cyan' },
	{ id: 'cloud', label: 'Cloud & DevOps', tone: 'indigo' },
	{ id: 'game', label: 'Game', tone: 'orange' },
	{ id: 'iot', label: 'IoT & hardware', tone: 'teal' },
	{ id: 'design', label: 'Desain & UI/UX', tone: 'rose' },
	{ id: 'security', label: 'Keamanan', tone: 'red' },
	{ id: 'testing', label: 'Testing & tooling', tone: 'slate' },
	{ id: 'topic', label: 'Topik / domain', tone: 'stone' },
];

/** [tag, grup, kategori karya yang disiratkan (opsional)] */
type Row = [string, KaryaTagGroupId, string?];

const ROWS: Row[] = [
	// ── Bahasa ──
	['javascript', 'language', 'web'], ['typescript', 'language', 'web'], ['python', 'language'], ['java', 'language'],
	['kotlin', 'language', 'mobile'], ['swift', 'language', 'mobile'], ['dart', 'language', 'mobile'], ['go', 'language'],
	['rust', 'language'], ['c', 'language'], ['c++', 'language'], ['c#', 'language'], ['php', 'language', 'web'],
	['ruby', 'language', 'web'], ['r', 'language', 'ai-data'], ['julia', 'language', 'ai-data'], ['scala', 'language'],
	['elixir', 'language'], ['lua', 'language', 'game'], ['matlab', 'language', 'ai-data'], ['sql', 'language'],
	['bash', 'language'], ['powershell', 'language'], ['html', 'language', 'web'], ['css', 'language', 'web'],
	['solidity', 'language'], ['assembly', 'language'], ['zig', 'language'], ['haskell', 'language'], ['objective-c', 'language', 'mobile'],
	// ── Frontend ──
	['react', 'frontend', 'web'], ['next.js', 'frontend', 'web'], ['vue', 'frontend', 'web'], ['nuxt', 'frontend', 'web'],
	['angular', 'frontend', 'web'], ['svelte', 'frontend', 'web'], ['sveltekit', 'frontend', 'web'], ['solidjs', 'frontend', 'web'],
	['astro', 'frontend', 'web'], ['remix', 'frontend', 'web'], ['vite', 'frontend', 'web'], ['tailwind css', 'frontend', 'web'],
	['bootstrap', 'frontend', 'web'], ['shadcn ui', 'frontend', 'web'], ['material ui', 'frontend', 'web'], ['chakra ui', 'frontend', 'web'],
	['jquery', 'frontend', 'web'], ['three.js', 'frontend', 'web'], ['d3.js', 'frontend', 'ai-data'], ['redux', 'frontend', 'web'],
	['tanstack query', 'frontend', 'web'], ['htmx', 'frontend', 'web'], ['alpine.js', 'frontend', 'web'], ['electron', 'frontend', 'desktop'],
	['tauri', 'frontend', 'desktop'], ['pwa', 'frontend', 'web'], ['webassembly', 'frontend', 'web'],
	// ── Backend ──
	['node.js', 'backend', 'web'], ['express', 'backend', 'web'], ['nestjs', 'backend', 'web'], ['fastify', 'backend', 'web'],
	['hono', 'backend', 'web'], ['laravel', 'backend', 'web'], ['codeigniter', 'backend', 'web'], ['symfony', 'backend', 'web'],
	['django', 'backend', 'web'], ['flask', 'backend', 'web'], ['fastapi', 'backend', 'web'], ['spring boot', 'backend', 'web'],
	['ruby on rails', 'backend', 'web'], ['asp.net', 'backend', 'web'], ['gin', 'backend', 'web'], ['fiber', 'backend', 'web'],
	['echo', 'backend', 'web'], ['actix', 'backend', 'web'], ['graphql', 'backend', 'web'], ['rest api', 'backend', 'web'],
	['grpc', 'backend'], ['websocket', 'backend', 'web'], ['socket.io', 'backend', 'web'], ['trpc', 'backend', 'web'],
	['prisma', 'backend', 'web'], ['drizzle', 'backend', 'web'], ['sequelize', 'backend', 'web'], ['mongoose', 'backend', 'web'],
	['strapi', 'backend', 'web'], ['wordpress', 'backend', 'web'],
	// ── Mobile ──
	['flutter', 'mobile', 'mobile'], ['react native', 'mobile', 'mobile'], ['expo', 'mobile', 'mobile'], ['android', 'mobile', 'mobile'],
	['ios', 'mobile', 'mobile'], ['jetpack compose', 'mobile', 'mobile'], ['swiftui', 'mobile', 'mobile'], ['ionic', 'mobile', 'mobile'],
	['capacitor', 'mobile', 'mobile'], ['kotlin multiplatform', 'mobile', 'mobile'], ['.net maui', 'mobile', 'mobile'], ['xamarin', 'mobile', 'mobile'],
	// ── Runtime & platform ──
	['bun', 'runtime', 'web'], ['deno', 'runtime', 'web'], ['jvm', 'runtime'], ['.net', 'runtime'], ['wasm', 'runtime'],
	['linux', 'runtime'], ['windows', 'runtime', 'desktop'], ['macos', 'runtime', 'desktop'], ['raspberry pi os', 'runtime', 'iot'],
	['cli', 'runtime'], ['browser extension', 'runtime', 'web'], ['chrome extension', 'runtime', 'web'], ['vs code extension', 'runtime'],
	['discord bot', 'runtime'], ['telegram bot', 'runtime'], ['whatsapp bot', 'runtime'],
	// ── Database ──
	['mysql', 'database'], ['postgresql', 'database'], ['mariadb', 'database'], ['sqlite', 'database'], ['mongodb', 'database'],
	['redis', 'database'], ['firebase', 'database', 'mobile'], ['firestore', 'database', 'mobile'], ['supabase', 'database', 'web'],
	['elasticsearch', 'database'], ['cassandra', 'database'], ['neo4j', 'database'], ['dynamodb', 'database'], ['oracle db', 'database'],
	['sql server', 'database'], ['pocketbase', 'database'], ['appwrite', 'database'], ['vector database', 'database', 'ai-data'],
	['pinecone', 'database', 'ai-data'], ['chromadb', 'database', 'ai-data'], ['qdrant', 'database', 'ai-data'], ['pgvector', 'database', 'ai-data'],
	// ── AI / ML / LLM ──
	['machine learning', 'ai', 'ai-data'], ['deep learning', 'ai', 'ai-data'], ['llm', 'ai', 'ai-data'], ['generative ai', 'ai', 'ai-data'],
	['rag', 'ai', 'ai-data'], ['ai agent', 'ai', 'ai-data'], ['prompt engineering', 'ai', 'ai-data'], ['nlp', 'ai', 'ai-data'],
	['computer vision', 'ai', 'ai-data'], ['speech recognition', 'ai', 'ai-data'], ['recommender system', 'ai', 'ai-data'],
	['tensorflow', 'ai', 'ai-data'], ['pytorch', 'ai', 'ai-data'], ['keras', 'ai', 'ai-data'], ['scikit-learn', 'ai', 'ai-data'],
	['xgboost', 'ai', 'ai-data'], ['hugging face', 'ai', 'ai-data'], ['transformers', 'ai', 'ai-data'], ['langchain', 'ai', 'ai-data'],
	['llamaindex', 'ai', 'ai-data'], ['openai api', 'ai', 'ai-data'], ['gemini api', 'ai', 'ai-data'], ['claude api', 'ai', 'ai-data'],
	['ollama', 'ai', 'ai-data'], ['llama', 'ai', 'ai-data'], ['yolo', 'ai', 'ai-data'], ['opencv', 'ai', 'ai-data'],
	['mediapipe', 'ai', 'ai-data'], ['tensorflow lite', 'ai', 'mobile'], ['onnx', 'ai', 'ai-data'], ['mcp', 'ai', 'ai-data'],
	// ── Data ──
	['data science', 'data', 'ai-data'], ['data analysis', 'data', 'ai-data'], ['data visualization', 'data', 'ai-data'],
	['pandas', 'data', 'ai-data'], ['numpy', 'data', 'ai-data'], ['matplotlib', 'data', 'ai-data'], ['seaborn', 'data', 'ai-data'],
	['jupyter', 'data', 'ai-data'], ['streamlit', 'data', 'ai-data'], ['gradio', 'data', 'ai-data'], ['power bi', 'data', 'ai-data'],
	['tableau', 'data', 'ai-data'], ['looker studio', 'data', 'ai-data'], ['apache spark', 'data', 'ai-data'], ['etl', 'data', 'ai-data'],
	['web scraping', 'data', 'ai-data'], ['beautifulsoup', 'data', 'ai-data'], ['selenium', 'data'], ['excel', 'data'],
	// ── Cloud & DevOps ──
	['docker', 'cloud'], ['kubernetes', 'cloud'], ['github actions', 'cloud'], ['gitlab ci', 'cloud'], ['ci/cd', 'cloud'],
	['aws', 'cloud'], ['google cloud', 'cloud'], ['azure', 'cloud'], ['vercel', 'cloud', 'web'], ['netlify', 'cloud', 'web'],
	['cloudflare', 'cloud', 'web'], ['railway', 'cloud'], ['render', 'cloud'], ['heroku', 'cloud'], ['nginx', 'cloud'],
	['terraform', 'cloud'], ['ansible', 'cloud'], ['serverless', 'cloud'], ['microservices', 'cloud'], ['pm2', 'cloud'],
	['linux server', 'cloud'], ['monitoring', 'cloud'],
	// ── Game ──
	['unity', 'game', 'game'], ['unreal engine', 'game', 'game'], ['godot', 'game', 'game'], ['phaser', 'game', 'game'],
	['pygame', 'game', 'game'], ['roblox', 'game', 'game'], ['game jam', 'game', 'game'], ['2d game', 'game', 'game'],
	['3d game', 'game', 'game'], ['vr', 'game', 'game'], ['ar', 'game', 'mobile'], ['blender', 'game'],
	// ── IoT ──
	['arduino', 'iot', 'iot'], ['esp32', 'iot', 'iot'], ['esp8266', 'iot', 'iot'], ['raspberry pi', 'iot', 'iot'],
	['mqtt', 'iot', 'iot'], ['blynk', 'iot', 'iot'], ['node-red', 'iot', 'iot'], ['sensor', 'iot', 'iot'],
	['embedded', 'iot', 'iot'], ['micropython', 'iot', 'iot'], ['platformio', 'iot', 'iot'], ['lora', 'iot', 'iot'],
	['robotics', 'iot', 'iot'], ['ros', 'iot', 'iot'], ['plc', 'iot', 'iot'],
	// ── Desain ──
	['figma', 'design', 'uiux'], ['ui/ux', 'design', 'uiux'], ['prototype', 'design', 'uiux'], ['user research', 'design', 'uiux'],
	['design system', 'design', 'uiux'], ['wireframe', 'design', 'uiux'], ['usability testing', 'design', 'uiux'],
	['adobe xd', 'design', 'uiux'], ['canva', 'design', 'uiux'], ['motion design', 'design', 'uiux'],
	// ── Keamanan ──
	['cybersecurity', 'security', 'security'], ['penetration testing', 'security', 'security'], ['ctf', 'security', 'security'],
	['cryptography', 'security', 'security'], ['owasp', 'security', 'security'], ['network security', 'security', 'security'],
	['malware analysis', 'security', 'security'], ['forensics', 'security', 'security'], ['blockchain', 'security'],
	['web3', 'security', 'web'], ['jwt', 'security', 'web'], ['oauth', 'security', 'web'],
	// ── Testing & tooling ──
	['jest', 'testing'], ['vitest', 'testing'], ['playwright', 'testing'], ['cypress', 'testing'], ['pytest', 'testing'],
	['junit', 'testing'], ['postman', 'testing'], ['eslint', 'testing'], ['git', 'testing'], ['uml', 'testing'],
	// ── Topik ──
	['e-commerce', 'topic', 'web'], ['sistem informasi', 'topic', 'web'], ['erp', 'topic', 'web'], ['pos / kasir', 'topic'],
	['pendidikan', 'topic'], ['kesehatan', 'topic'], ['keuangan', 'topic'], ['pertanian', 'topic', 'iot'], ['pariwisata', 'topic'],
	['sosial', 'topic'], ['islami', 'topic'], ['chatbot', 'topic', 'ai-data'], ['dashboard', 'topic', 'web'], ['portfolio', 'topic', 'web'],
	['landing page', 'topic', 'web'], ['cms', 'topic', 'web'], ['open source', 'topic'], ['skripsi', 'topic'], ['tugas kuliah', 'topic'],
	['lomba', 'topic'], ['hackathon', 'topic'],
];

export interface KaryaTagDef {
	tag: string;
	group: KaryaTagGroupId;
	category?: string;
}

export const KARYA_TAGS: KaryaTagDef[] = ROWS.map(([tag, group, category]) => ({ tag, group, category }));

const BY_TAG = new Map(KARYA_TAGS.map((t) => [t.tag, t]));

/** Alias penulisan umum → tag kanonik. */
const ALIASES: Record<string, string> = {
	js: 'javascript', ts: 'typescript', py: 'python', golang: 'go', cpp: 'c++', csharp: 'c#', 'c sharp': 'c#',
	reactjs: 'react', 'react.js': 'react', nextjs: 'next.js', next: 'next.js', vuejs: 'vue', 'vue.js': 'vue', nuxtjs: 'nuxt',
	angularjs: 'angular', nodejs: 'node.js', node: 'node.js', expressjs: 'express', nest: 'nestjs', tailwind: 'tailwind css',
	tailwindcss: 'tailwind css', mui: 'material ui', shadcn: 'shadcn ui', 'react-native': 'react native', reactnative: 'react native',
	postgres: 'postgresql', mongo: 'mongodb', 'scikit learn': 'scikit-learn', sklearn: 'scikit-learn', huggingface: 'hugging face',
	'large language model': 'llm', 'large-language-model': 'llm', genai: 'generative ai', 'gen-ai': 'generative ai', openai: 'openai api',
	gemini: 'gemini api', chatgpt: 'openai api', ml: 'machine learning', 'machine-learning': 'machine learning', dl: 'deep learning',
	'deep-learning': 'deep learning', cv: 'computer vision', 'computer-vision': 'computer vision', k8s: 'kubernetes', gcp: 'google cloud',
	'github-actions': 'github actions', cicd: 'ci/cd', 'ci-cd': 'ci/cd', uiux: 'ui/ux', 'ui-ux': 'ui/ux', ux: 'ui/ux', ui: 'ui/ux',
	iot: 'sensor', 'raspberry-pi': 'raspberry pi', esp: 'esp32', 'rest-api': 'rest api', restapi: 'rest api', api: 'rest api',
	'spring-boot': 'spring boot', springboot: 'spring boot', rails: 'ruby on rails', dotnet: '.net', 'asp.net core': 'asp.net',
	jupyter_notebook: 'jupyter', 'jupyter notebook': 'jupyter', 'web-scraping': 'web scraping', scraping: 'web scraping',
	'data-science': 'data science', 'data-analysis': 'data analysis', 'data-visualization': 'data visualization', 'unreal': 'unreal engine',
	'three-js': 'three.js', threejs: 'three.js', d3: 'd3.js', 'vector-database': 'vector database', 'tf-lite': 'tensorflow lite', tflite: 'tensorflow lite',
	'tensorflow-lite': 'tensorflow lite', ecommerce: 'e-commerce', 'e-commerce': 'e-commerce', chatbots: 'chatbot', supabase: 'supabase',
	'html5': 'html', css3: 'css', scss: 'css', sass: 'css', kotlinx: 'kotlin', 'jetpack-compose': 'jetpack compose',
};

/** Normalisasi satu tag ke bentuk kanonik bila dikenal (selain itu dikembalikan apa adanya, huruf kecil). */
export function canonicalKaryaTag(raw: string): string {
	const v = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
	if (BY_TAG.has(v)) return v;
	if (ALIASES[v]) return ALIASES[v];
	const dashless = v.replace(/-/g, ' ');
	if (BY_TAG.has(dashless)) return dashless;
	return v;
}

export function karyaTagGroup(tag: string): KaryaTagGroupId | null {
	return BY_TAG.get(canonicalKaryaTag(tag))?.group || null;
}

/** Kelas warna chip per grup (Tailwind, aman light/dark). */
export const KARYA_TAG_TONE_CLASS: Record<string, string> = {
	sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
	violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
	emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
	pink: 'bg-pink-500/10 text-pink-700 dark:text-pink-300',
	lime: 'bg-lime-500/10 text-lime-700 dark:text-lime-300',
	amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
	fuchsia: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
	cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
	indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
	orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
	teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
	rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
	red: 'bg-red-500/10 text-red-700 dark:text-red-300',
	slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
	stone: 'bg-stone-500/10 text-stone-700 dark:text-stone-300',
};

export function karyaTagToneClass(tag: string): string {
	const g = karyaTagGroup(tag);
	const tone = KARYA_TAG_GROUPS.find((x) => x.id === g)?.tone || 'sky';
	return KARYA_TAG_TONE_CLASS[tone];
}

/** File penanda di root repo → tag. */
const FILE_TAGS: [RegExp, string][] = [
	[/^pubspec\.yaml$/i, 'flutter'], [/^android$/i, 'android'], [/^ios$/i, 'ios'], [/^app\.json$/i, 'expo'],
	[/^capacitor\.config\./i, 'capacitor'], [/^ionic\.config\.json$/i, 'ionic'], [/^next\.config\./i, 'next.js'],
	[/^nuxt\.config\./i, 'nuxt'], [/^vite\.config\./i, 'vite'], [/^svelte\.config\./i, 'svelte'], [/^astro\.config\./i, 'astro'],
	[/^angular\.json$/i, 'angular'], [/^tailwind\.config\./i, 'tailwind css'], [/^artisan$/i, 'laravel'], [/^composer\.json$/i, 'php'],
	[/^manage\.py$/i, 'django'], [/^requirements\.txt$/i, 'python'], [/^pyproject\.toml$/i, 'python'], [/^package\.json$/i, 'node.js'],
	[/^bun\.lockb?$/i, 'bun'], [/^deno\.jsonc?$/i, 'deno'], [/^go\.mod$/i, 'go'], [/^cargo\.toml$/i, 'rust'], [/^pom\.xml$/i, 'java'],
	[/^build\.gradle(\.kts)?$/i, 'java'], [/^dockerfile$/i, 'docker'], [/^docker-compose\.ya?ml$/i, 'docker'], [/^compose\.ya?ml$/i, 'docker'],
	[/^\.github$/i, 'github actions'], [/^vercel\.json$/i, 'vercel'], [/^netlify\.toml$/i, 'netlify'], [/^firebase\.json$/i, 'firebase'],
	[/^prisma$/i, 'prisma'], [/^platformio\.ini$/i, 'platformio'], [/\.ino$/i, 'arduino'], [/^project\.godot$/i, 'godot'],
	[/^assets$|^projectsettings$/i, 'unity'], [/^electron/i, 'electron'], [/^src-tauri$/i, 'tauri'], [/^manifest\.json$/i, 'browser extension'],
	[/^streamlit_app\.py$|^\.streamlit$/i, 'streamlit'], [/\.ipynb$/i, 'jupyter'], [/^supabase$/i, 'supabase'], [/^serverless\.ya?ml$/i, 'serverless'],
	[/^k8s$|^helm$/i, 'kubernetes'], [/^terraform$|\.tf$/i, 'terraform'],
];

/** Kata kunci di README/deskripsi → tag (hanya yang jelas, agar tidak salah tebak). */
const TEXT_TAGS: [RegExp, string][] = [
	[/\bflutter\b/i, 'flutter'], [/\breact native\b/i, 'react native'], [/\b(android|apk)\b/i, 'android'], [/\b(ios|iphone)\b/i, 'ios'],
	[/\b(aplikasi mobile|mobile app|mobile application|aplikasi android)\b/i, 'android'], [/\bnext\.?js\b/i, 'next.js'],
	[/\breact(\.js)?\b/i, 'react'], [/\bvue(\.js)?\b/i, 'vue'], [/\blaravel\b/i, 'laravel'], [/\bdjango\b/i, 'django'],
	[/\bfastapi\b/i, 'fastapi'], [/\bflask\b/i, 'flask'], [/\bexpress(\.js)?\b/i, 'express'], [/\bnode\.?js\b/i, 'node.js'],
	[/\b(llm|large language model)s?\b/i, 'llm'], [/\b(rag|retrieval[- ]augmented)\b/i, 'rag'], [/\bgemini\b/i, 'gemini api'],
	[/\b(openai|gpt-4|gpt-5|chatgpt)\b/i, 'openai api'], [/\bclaude\b/i, 'claude api'], [/\blangchain\b/i, 'langchain'],
	[/\bollama\b/i, 'ollama'], [/\b(tensorflow|tf\.keras)\b/i, 'tensorflow'], [/\bpytorch\b/i, 'pytorch'], [/\bscikit-learn|sklearn\b/i, 'scikit-learn'],
	[/\byolo(v\d+)?\b/i, 'yolo'], [/\bopencv\b/i, 'opencv'], [/\bmachine learning\b/i, 'machine learning'], [/\bdeep learning\b/i, 'deep learning'],
	[/\bchat ?bot\b/i, 'chatbot'], [/\bmongodb\b/i, 'mongodb'], [/\bmysql\b/i, 'mysql'], [/\bpostgre(s|sql)\b/i, 'postgresql'],
	[/\bfirebase\b/i, 'firebase'], [/\bsupabase\b/i, 'supabase'], [/\bredis\b/i, 'redis'], [/\bdocker\b/i, 'docker'],
	[/\besp32\b/i, 'esp32'], [/\barduino\b/i, 'arduino'], [/\bmqtt\b/i, 'mqtt'], [/\braspberry pi\b/i, 'raspberry pi'],
	[/\bunity\b/i, 'unity'], [/\bgodot\b/i, 'godot'], [/\bfigma\b/i, 'figma'], [/\bstreamlit\b/i, 'streamlit'],
	[/\btailwind\b/i, 'tailwind css'], [/\bpwa\b|progressive web app/i, 'pwa'], [/\bwebsocket|socket\.io\b/i, 'websocket'],
	[/\bdashboard\b/i, 'dashboard'], [/\be-?commerce\b/i, 'e-commerce'],
];

const CATEGORY_ORDER = ['mobile', 'web', 'ai-data', 'game', 'iot', 'desktop', 'cloud', 'security', 'blockchain', 'sistem-informasi', 'tools', 'riset', 'uiux', 'multimedia', 'ar-vr', 'bot', 'robotika', 'jaringan'];

export interface KaryaStackInput {
	languages?: string[];
	/** Porsi byte (0–1) sejajar `languages`; kosong = dianggap urutan saja. */
	languageShares?: number[];
	files?: string[];
	topics?: string[];
	text?: string;
	homepage?: string;
}

/**
 * Tebak kategori (bisa lebih dari satu) dan tag dari isi repo.
 * Contoh: repo Flutter + backend Next.js → kategori ["mobile", "web"], tag ["flutter", "dart", "next.js", …].
 */
export function inferKaryaStack(input: KaryaStackInput): { categories: string[]; tags: string[] } {
	const score = new Map<string, number>();
	const add = (t: string, w: number) => {
		const c = canonicalKaryaTag(t);
		if (!c) return;
		score.set(c, (score.get(c) || 0) + w);
	};
	// 3 bahasa terbanyak (porsi ≥ 5%) menjadi dasar kategori. Bahasa 'strong' langsung menetapkan kategorinya;
	// bahasa serbaguna ('weak') hanya menambah bobot dan perlu bukti lain (file/framework/topik/README).
	const langs = input.languages || [];
	const shares = input.languageShares || [];
	const catScore = new Map<string, number>();
	const forced = new Set<string>();
	const addCat = (c: string, w: number) => catScore.set(c, (catScore.get(c) || 0) + w);
	let counted = 0;
	langs.forEach((l, i) => {
		const def = languageDef(l);
		const share = typeof shares[i] === 'number' ? shares[i] : i === 0 ? 0.6 : i < 3 ? 0.15 : 0.03;
		add(def.tag, i === 0 ? 4 : i < 3 ? 2 : 1);
		if (!def.category || counted >= 3 || share < 0.05) return;
		counted++;
		if (def.strength === 'strong') {
			forced.add(def.category);
			addCat(def.category, 6 + share * 6);
		} else addCat(def.category, 1 + share * 2);
	});
	for (const f of input.files || []) for (const [re, tag] of FILE_TAGS) if (re.test(f)) add(tag, 3);
	for (const t of input.topics || []) add(t, 3);
	const text = String(input.text || '').slice(0, 20000);
	for (const [re, tag] of TEXT_TAGS) if (re.test(text)) add(tag, 2);

	const tags = Array.from(score.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([t]) => t)
		.filter((t) => t.length <= 30);

	for (const [t, s] of Array.from(score.entries())) {
		const c = BY_TAG.get(t)?.category;
		if (c) addCat(c, s);
	}
	// Ada homepage web → minimal juga Web.
	if (input.homepage && /^https:\/\//.test(input.homepage) && !/play\.google|apps\.apple/.test(input.homepage)) catScore.set('web', (catScore.get('web') || 0) + 2);
	if (/play\.google|apps\.apple/.test(input.homepage || '')) catScore.set('mobile', (catScore.get('mobile') || 0) + 4);
	const top = Math.max(0, ...Array.from(catScore.values()));
	const categories = Array.from(catScore.entries())
		.filter(([c, s]) => forced.has(c) || s >= Math.max(3, top * 0.35))
		.sort((a, b) => b[1] - a[1] || CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
		.map(([c]) => c)
		.slice(0, 3);
	return { categories, tags };
}
