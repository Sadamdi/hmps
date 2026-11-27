import { STUDENT_SPACE_PATHS } from '@shared/student-space-paths';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type {
	KaryaLink,
	KaryaMedia,
	KaryaProjectCard,
	KaryaRelated,
	KaryaRepoInfo,
	KaryaSocialLinks,
	KaryaStatus,
	KaryaStudentPublic,
	KaryaVisibility,
} from '@shared/karya';

export interface KaryaWarning {
	id: string;
	message: string;
	byName: string;
	at: string;
	acknowledgedAt: string | null;
}

export interface KaryaStudentAccount {
	/** false = belum menyelesaikan onboarding username */
	usernameSet?: boolean;
	profileReadme?: string;
	warnings?: KaryaWarning[];
	id: string;
	email: string;
	emailVerified: boolean;
	nim: string;
	angkatan: number | null;
	username: string;
	name: string;
	headline: string;
	bio: string;
	avatarUrl: string;
	skills: string[];
	social: KaryaSocialLinks;
	profilePublic: boolean;
	hasPassword: boolean;
	googleLinked: boolean;
	verifiedTi: boolean;
	createdByAdmin: boolean;
	storageUsedBytes: number;
	previousLoginAt: string | null;
	createdAt: string;
}

export interface KaryaOwnProject {
	coverUrl?: string;
	coverGenerated?: boolean;
	contributors?: import('@/components/karya/contributors-editor').ContributorRow[];
	id: string;
	slug: string;
	title: string;
	summary: string;
	description: string;
	descriptionFormat?: 'text' | 'html';
	role: string;
	category: string;
	categories?: string[];
	tags: string[];
	year: number | null;
	repos: KaryaRepoInfo[];
	links: KaryaLink[];
	media: KaryaMedia[];
	coverMediaId: string;
	related: KaryaRelated[];
	visibility: KaryaVisibility;
	status: KaryaStatus;
	reviewNote: string;
	warnings?: KaryaWarning[];
	featured: boolean;
	viewCount: number;
	publishedAt: string | null;
	submittedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface KaryaConfig {
	enabled: boolean;
	registrationOpen: boolean;
	reviewMode: 'manual' | 'auto';
	uploadsEnabled: boolean;
	tutorialYoutubeUrl?: string;
	tutorialGdriveUrl?: string;
	shortlinkReview: boolean;
	googleEnabled: boolean;
	limits: {
		quotaBytesPerStudent: number;
		maxProjectsPerStudent: number;
		maxImagesPerProject: number;
		maxImageBytes: number;
		maxVideosPerProject: number;
		maxVideoBytes: number;
		maxLinksPerProject: number;
		maxTagsPerProject: number;
		maxShortlinksPerStudent: number;
	};
	categories: { id: string; label: string }[];
}

export interface KaryaProjectDetail {
	contributors?: import('@shared/karya').KaryaContributorPublic[];
	slug: string;
	title: string;
	summary: string;
	description: string;
	role: string;
	category: string;
	categories?: string[];
	tags: string[];
	year: number | null;
	repos: KaryaRepoInfo[];
	links: KaryaLink[];
	media: KaryaMedia[];
	coverUrl: string;
	coverGenerated?: boolean;
	descriptionFormat?: 'text' | 'html';
	related: { projectSlug?: string; url?: string; label: string }[];
	relatedCards: KaryaProjectCard[];
	relatedAuto: KaryaProjectCard[];
	preview?: boolean;
	status?: KaryaStatus;
	visibility?: KaryaVisibility;
	moreFromAuthor: KaryaProjectCard[];
	viewCount: number;
	publishedAt: string | null;
	updatedAt: string;
	author: KaryaStudentPublic;
}

/** Panggil /api/karya/* dan kembalikan `data` (error dilempar dengan pesan server). */
export async function karyaApi<T = any>(method: string, path: string, body?: unknown): Promise<T> {
	const r = await apiRequest(method, `/api/karya${path}`, body);
	const j = await r.json().catch(() => ({}));
	return (j?.data ?? null) as T;
}

/** GET dengan meta (list berhalaman). */
export async function karyaGetList<T = any>(path: string): Promise<{ data: T[]; meta: { page: number; limit: number; total: number } }> {
	const r = await fetch(`/api/karya${path}`, { credentials: 'include', headers: { Accept: 'application/json' } });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(j?.message || 'Gagal memuat data');
	return { data: j.data || [], meta: j.meta || { page: 1, limit: 12, total: 0 } };
}

async function getData<T>(path: string): Promise<T | null> {
	const r = await fetch(`/api/karya${path}`, { credentials: 'include', headers: { Accept: 'application/json' } });
	if (r.status === 404) return null;
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(j?.message || 'Gagal memuat data');
	return (j?.data ?? null) as T;
}

export function useKaryaConfig() {
	return useQuery<KaryaConfig | null>({ queryKey: ['karya-config'], queryFn: () => getData<KaryaConfig>('/auth/config'), staleTime: 60_000 });
}

/** Mahasiswa yang sedang login (null = belum). Terpisah dari login pengurus & pembeli. */
export function useStudent() {
	const q = useQuery<KaryaStudentAccount | null>({
		queryKey: ['karya-me'],
		queryFn: async () => (await getData<{ student: KaryaStudentAccount | null }>('/auth/me'))?.student ?? null,
		staleTime: 60_000,
	});
	// Data lama kosong yang sedang dimuat ulang (mis. tepat setelah daftar/masuk) dihitung masih memuat — mencegah
	// halaman terlindungi melempar ke /login sebelum sesi baru terbaca.
	return { student: q.data ?? null, loading: q.isLoading || (q.isFetching && !q.data), refetch: q.refetch };
}

/** Isi cache akun mahasiswa langsung dari respons login/daftar (tanpa menunggu refetch). */
export function setStudentCache(student: KaryaStudentAccount | null | undefined) {
	if (student) queryClient.setQueryData(['karya-me'], student);
}

export function refreshStudent() {
	queryClient.invalidateQueries({ queryKey: ['karya-me'] });
	queryClient.invalidateQueries({ queryKey: ['karya-my-projects'] });
	queryClient.invalidateQueries({ queryKey: ['karya-my-stats'] });
}

export function useMyProjects(enabled = true) {
	return useQuery<KaryaOwnProject[]>({ queryKey: ['karya-my-projects'], queryFn: async () => (await getData<KaryaOwnProject[]>('/me/projects')) || [], enabled });
}

export function useMyProject(id: string | null) {
	return useQuery<KaryaOwnProject | null>({ queryKey: ['karya-my-project', id], queryFn: () => getData<KaryaOwnProject>(`/me/projects/${id}`), enabled: !!id });
}

export function useMyStats(enabled = true) {
	return useQuery<{ counts: Record<string, number>; totalViews: number; shortlinkClicks: number; storageUsedBytes: number; quotaBytes: number } | null>({
		queryKey: ['karya-my-stats'],
		queryFn: () => getData('/me/stats'),
		enabled,
	});
}

export function usePublicProjects(params: { q?: string; tag?: string; category?: string; sort?: string; page?: number; limit?: number; angkatan?: number }) {
	const sp = new URLSearchParams();
	Object.entries(params).forEach(([k, v]) => {
		if (v !== undefined && v !== '' && v !== 0) sp.set(k, String(v));
	});
	const qs = sp.toString();
	return useQuery({ queryKey: ['karya-public', qs], queryFn: () => karyaGetList<KaryaProjectCard>(`/public/projects?${qs}`), staleTime: 30_000 });
}

export interface KaryaStudentListItem {
	username: string;
	name: string;
	angkatan: number | null;
	headline: string;
	avatarUrl: string;
	skills: string[];
	projectCount: number;
	topTags: string[];
}

export function usePublicStudents(params: { q?: string; angkatan?: number; page?: number; limit?: number }, enabled = true) {
	const sp = new URLSearchParams();
	Object.entries(params).forEach(([k, v]) => {
		if (v !== undefined && v !== '' && v !== 0) sp.set(k, String(v));
	});
	const qs = sp.toString();
	return useQuery({ queryKey: ['karya-public-students', qs], queryFn: () => karyaGetList<KaryaStudentListItem>(`/public/students?${qs}`), staleTime: 30_000, enabled });
}

export function usePublicCategories() {
	return useQuery<{ id: string; count: number }[]>({ queryKey: ['karya-categories'], queryFn: async () => (await getData<{ id: string; count: number }[]>('/public/categories')) || [], staleTime: 60_000 });
}

export function usePublicTags() {
	return useQuery<{ tag: string; count: number }[]>({ queryKey: ['karya-tags'], queryFn: async () => (await getData<{ tag: string; count: number }[]>('/public/tags')) || [], staleTime: 60_000 });
}

export function usePublicProject(slug: string) {
	return useQuery<KaryaProjectDetail | null>({ queryKey: ['karya-project', slug], queryFn: () => getData<KaryaProjectDetail>(`/public/projects/${encodeURIComponent(slug)}`), enabled: !!slug });
}

export function usePublicStudent(username: string) {
	return useQuery<{ student: KaryaStudentPublic; projects: KaryaProjectCard[]; redirectTo?: string; indexable?: boolean } | null>({
		queryKey: ['karya-student', username],
		queryFn: () => getData(`/public/students/${encodeURIComponent(username)}`),
		enabled: !!username,
	});
}

export function useProjectPreview(id: string) {
	return useQuery<KaryaProjectDetail | null>({ queryKey: ['karya-preview', id], queryFn: () => getData<KaryaProjectDetail>(`/me/projects/${id}/preview`), enabled: !!id });
}

export function useProfilePreview(enabled = true) {
	return useQuery<{ student: KaryaStudentPublic; projects: KaryaProjectCard[]; preview: boolean; visible: boolean } | null>({
		queryKey: ['karya-profile-preview'],
		queryFn: () => getData('/me/profile/preview'),
		enabled,
	});
}

export function usePublicTag(tag: string) {
	return useQuery<{ tag: string; total: number; related: { tag: string; count: number }[] } | null>({
		queryKey: ['karya-tag', tag],
		queryFn: () => getData(`/public/tags/${encodeURIComponent(tag)}`),
		enabled: !!tag,
	});
}

/** Alamat halaman Karya & Ruang Mahasiswa (lihat shared/student-space-paths.ts). */
export const KARYA_PATHS = {
	...STUDENT_SPACE_PATHS,
	index: STUDENT_SPACE_PATHS.karya,
};
