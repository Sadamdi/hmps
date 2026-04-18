import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import MediaDisplay from '@/components/MediaDisplay';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth';
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ChevronLeft,
	ChevronRight,
	GripVertical,
	Link2,
	Loader2,
	Minus,
	Package,
	Pencil,
	Plus,
	Settings2,
	Share2,
	ShoppingBag,
	Tag,
	Trash2,
	Upload,
} from 'lucide-react';
import { buildTokoSpyroPageData } from '@shared/dashboard-spyro-context';
import {
	effectiveProductCurrency,
	formatAmountForInput,
	formatStoreMoney,
	listCommonCurrencyCodes,
	normalizeStoreCurrency,
	parseAmountInput,
} from '@shared/store-currency';
import { getStoreStockAvailable, normalizePriceTiersInput } from '@shared/store-pricing';
import { Link, useLocation } from 'wouter';
import { useEffect, useMemo, useRef, useState } from 'react';

const COMMON_CURRENCIES = listCommonCurrencyCodes();

function isImageLikeFile(file: File): boolean {
	const mime = String(file.type || '').toLowerCase();
	if (mime.startsWith('image/')) return true;
	return /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name || '');
}

type AdminProductsPage = { items: any[]; total: number; page: number; limit: number };

function DashboardSortableProductCard({
	id,
	reorderMode,
	children,
}: {
	id: string;
	reorderMode: boolean;
	children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
		disabled: !reorderMode,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.85 : 1,
	};
	return (
		<div ref={setNodeRef} style={style} className="h-full">
			{children(
				reorderMode ? (
					<button
						type="button"
						className="absolute left-2 top-2 z-10 rounded-md border bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground cursor-grab"
						aria-label="Seret untuk mengurutkan"
						{...attributes}
						{...listeners}>
						<GripVertical className="h-4 w-4" />
					</button>
				) : null,
			)}
		</div>
	);
}

function SortableBlock({
	id,
	children,
}: {
	id: string;
	children: (handle: React.ReactNode) => React.ReactNode;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.7 : 1,
	};
	return (
		<div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg border p-3 bg-card">
			<button
				type="button"
				className="mt-1 text-muted-foreground hover:text-foreground cursor-grab"
				{...attributes}
				{...listeners}>
				<GripVertical className="h-5 w-5" />
			</button>
			<div className="flex-1 min-w-0">{children(<span className="sr-only">{id}</span>)}</div>
		</div>
	);
}

export default function DashboardToko() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { hasSpecificPermission } = useAuth();
	const [, setLocation] = useLocation();
	const canManage = hasSpecificPermission('toko.manage');

	const accessUrl = useApiUrl('/store/admin/access-summary');
	const settingsUrl = useApiUrl('/store/admin/settings');
	const productsUrl = useApiUrl('/store/admin/products');
	const categoriesUrl = useApiUrl('/store/admin/categories');
	const ordersUrl = useApiUrl('/store/admin/orders');
	const adminSharesBase = useApiUrl('/store/admin/shares');
	const publicStoreSettingsKey = useApiUrl('/store/public/settings');
	const publicProductsKey = useApiUrl('/store/public/products');
	const productsReorderUrl = useApiUrl('/store/admin/products/reorder');
	const storeUploadImageUrl = useApiUrl('/store/admin/upload-product-image');
	const storeCleanupUploadUrl = useApiUrl('/store/admin/uploads/cleanup');
	const thumbFileRef = useRef<HTMLInputElement>(null);
	const galleryFileRef = useRef<HTMLInputElement>(null);

	const { data: access, isLoading: accessLoading } = useQuery<{
		canOpenDashboard: boolean;
		hasTokoManage: boolean;
	}>({
		queryKey: [accessUrl],
		queryFn: async () => {
			const res = await fetch(accessUrl, { credentials: 'include' });
			if (!res.ok) throw new Error('access');
			return res.json();
		},
	});

	useEffect(() => {
		if (accessLoading || !access) return;
		if (!access.canOpenDashboard) setLocation('/dashboard');
	}, [access, accessLoading, setLocation]);

	const { data: settings, isLoading: settingsLoading } = useQuery({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const res = await fetch(settingsUrl, { credentials: 'include' });
			if (!res.ok) throw new Error('settings');
			return res.json();
		},
		enabled: !!access?.canOpenDashboard,
	});

	const [settingsDraft, setSettingsDraft] = useState<any>(null);
	useEffect(() => {
		if (settings) setSettingsDraft({ ...settings });
	}, [settings]);
	const s = settingsDraft ?? settings;

	const { basePath } = useTenant();
	const tenantPrefix = basePath || '';
	const prefixPub = (path: string) => (tenantPrefix ? `${tenantPrefix}${path}` : path);
	const publicStoreBasePath = useMemo(() => {
		const raw = String((s as { navbarPath?: string } | undefined)?.navbarPath || '/toko').trim();
		if (!raw) return '/toko';
		const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	}, [(s as { navbarPath?: string } | undefined)?.navbarPath]);

	const [productPage, setProductPage] = useState(1);
	const [reorderMode, setReorderMode] = useState(false);
	const [reorderIds, setReorderIds] = useState<string[]>([]);
	const reorderInitRef = useRef(false);

	const adminProductsListUrl = useMemo(() => {
		if (reorderMode && canManage) return `${productsUrl}?forReorder=1`;
		const p = new URLSearchParams();
		p.set('limit', '9');
		p.set('page', String(productPage));
		return `${productsUrl}?${p.toString()}`;
	}, [productsUrl, productPage, reorderMode, canManage]);

	const { data: productsPayload, isLoading: productsLoading } = useQuery<AdminProductsPage>({
		queryKey: ['store-admin-products', adminProductsListUrl],
		queryFn: async () => {
			const res = await fetch(adminProductsListUrl, { credentials: 'include' });
			if (!res.ok) throw new Error('products');
			return res.json();
		},
		enabled: !!access?.canOpenDashboard,
	});

	const products = productsPayload?.items ?? [];
	const totalAdminProducts = productsPayload?.total ?? 0;
	const adminPageLimit = productsPayload?.limit ?? 9;
	const adminTotalPages = Math.max(1, Math.ceil(totalAdminProducts / adminPageLimit));

	const displayProducts = useMemo(() => {
		if (!reorderMode || !reorderIds.length) return products;
		const m = new Map(products.map((p: any) => [String(p._id), p]));
		return reorderIds.map((id) => m.get(id)).filter(Boolean) as any[];
	}, [reorderMode, reorderIds, products]);

	useEffect(() => {
		if (!reorderMode) {
			reorderInitRef.current = false;
			setReorderIds([]);
			return;
		}
		if (productsLoading || !products.length) return;
		if (!reorderInitRef.current) {
			setReorderIds(products.map((p: any) => String(p._id)));
			reorderInitRef.current = true;
		}
	}, [reorderMode, productsLoading, products]);

	const { data: storeCategories = [] } = useQuery<{ _id: string; name: string; slug: string }[]>({
		queryKey: [categoriesUrl],
		queryFn: async () => {
			const res = await fetch(categoriesUrl, { credentials: 'include' });
			if (!res.ok) return [];
			return res.json();
		},
		enabled: !!access?.canOpenDashboard,
	});

	const { data: orders = [] } = useQuery<any[]>({
		queryKey: [ordersUrl],
		queryFn: async () => {
			const res = await fetch(ordersUrl, { credentials: 'include' });
			if (!res.ok) throw new Error('orders');
			return res.json();
		},
		enabled: !!access?.canOpenDashboard && canManage,
	});

	const [layoutBlocks, setLayoutBlocks] = useState<any[]>([]);
	useEffect(() => {
		if (settings?.layoutBlocks?.length) setLayoutBlocks(settings.layoutBlocks);
	}, [settings]);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const productGridSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const saveSettingsMutation = useMutation({
		mutationFn: (body: Record<string, unknown>) => apiRequest('PUT', settingsUrl, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [settingsUrl] });
			queryClient.invalidateQueries({ queryKey: [publicStoreSettingsKey] });
			toast({ title: 'Pengaturan disimpan' });
		},
		onError: () => toast({ title: 'Gagal menyimpan', variant: 'destructive' }),
	});

	const onLayoutDragEnd = (e: DragEndEvent) => {
		const { active, over } = e;
		if (!over || active.id === over.id) return;
		const oldIndex = layoutBlocks.findIndex((b) => b.id === active.id);
		const newIndex = layoutBlocks.findIndex((b) => b.id === over.id);
		if (oldIndex < 0 || newIndex < 0) return;
		const next = arrayMove(layoutBlocks, oldIndex, newIndex).map((b, i) => ({
			...b,
			order: i,
		}));
		setLayoutBlocks(next);
	};

	const [tokoTab, setTokoTab] = useState('products');
	const [productOpen, setProductOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState({
		name: '',
		slug: '',
		shortDescription: '',
		descriptionHtml: '',
		price: 0,
		/** ISO 4217 kosong = pakai default toko */
		currency: '',
		/** false = stok tak terbatas (kirim stock -1) */
		trackStock: false,
		stockCount: 0,
		priceTiers: [] as { minQty: number; unitPrice: number; applyMultiples: boolean }[],
		thumbnail: '',
		thumbnailSource: 'local' as 'local' | 'gdrive',
		thumbnailGdriveFileId: '',
		gallery: [] as { url: string; source: string; gdriveFileId?: string }[],
		videoUrl: '',
		whatsappPhoneOverride: '',
		whatsappContactNameOverride: '',
		buyMessageTemplateOverride: '',
		storeAddressOverride: '',
		published: false,
		/** kosong = tanpa kategori */
		categoryId: '',
	});
	const [newCategoryOpen, setNewCategoryOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState('');
	const [uploadingThumb, setUploadingThumb] = useState(false);
	const [uploadingGallery, setUploadingGallery] = useState(false);
	const [galleryUploadTargetIndex, setGalleryUploadTargetIndex] = useState<number | null>(null);
	const [galleryLinkDraft, setGalleryLinkDraft] = useState('');
	const [galleryEditIndex, setGalleryEditIndex] = useState<number | null>(null);
	const [galleryEditUrl, setGalleryEditUrl] = useState('');
	const [sessionUploadedUrls, setSessionUploadedUrls] = useState<string[]>([]);

	const getStoreLikeUrls = (f: typeof form) => {
		const out: string[] = [];
		if (String(f.thumbnail || '').startsWith('/uploads/')) out.push(String(f.thumbnail));
		for (const g of f.gallery || []) {
			const u = String(g?.url || '');
			if (u.startsWith('/uploads/')) out.push(u);
		}
		return Array.from(new Set(out));
	};

	const cleanupStoreUploads = async (urls: string[]) => {
		const unique = Array.from(new Set(urls.map((u) => String(u || '').trim()).filter(Boolean)));
		if (!unique.length) return;
		try {
			await apiRequest('POST', storeCleanupUploadUrl, { urls: unique });
		} catch {
			// best effort cleanup; tidak blok UI
		}
	};

	function normalizeGalleryItem(raw: any) {
		const url = String(typeof raw === 'string' ? raw : raw?.url || '').trim();
		if (!url) return null;
		const source =
			raw?.source === 'gdrive' || url.includes('drive.google.com')
				? ('gdrive' as const)
				: ('local' as const);
		return {
			url,
			source,
			gdriveFileId: String(raw?.gdriveFileId || '').trim(),
		};
	}

	function normalizeGalleryList(rawList: any[]) {
		return rawList
			.map((it) => normalizeGalleryItem(it))
			.filter((it): it is NonNullable<ReturnType<typeof normalizeGalleryItem>> => !!it)
			.slice(0, 10);
	}

	const closeProductDialog = async () => {
		await cleanupStoreUploads(sessionUploadedUrls);
		setSessionUploadedUrls([]);
		setGalleryUploadTargetIndex(null);
		setGalleryEditIndex(null);
		setGalleryEditUrl('');
		setGalleryLinkDraft('');
		setProductOpen(false);
	};

	const defaultStoreCurrency = normalizeStoreCurrency(s?.defaultCurrency);
	const effectiveFormCurrency = form.currency?.trim()
		? normalizeStoreCurrency(form.currency)
		: defaultStoreCurrency;

	const openNewProduct = () => {
		setEditingId(null);
		setSessionUploadedUrls([]);
		setGalleryLinkDraft('');
		setGalleryEditIndex(null);
		setGalleryEditUrl('');
		setGalleryUploadTargetIndex(null);
		setForm({
			name: '',
			slug: '',
			shortDescription: '',
			descriptionHtml: '',
			price: 0,
			currency: '',
			trackStock: false,
			stockCount: 0,
			priceTiers: [],
			thumbnail: '',
			thumbnailSource: 'local',
			thumbnailGdriveFileId: '',
			gallery: [],
			videoUrl: '',
			whatsappPhoneOverride: '',
			whatsappContactNameOverride: '',
			buyMessageTemplateOverride: '',
			storeAddressOverride: '',
			published: false,
			categoryId: '',
		});
		setProductOpen(true);
	};

	const openEdit = (p: any) => {
		setEditingId(p._id);
		setSessionUploadedUrls([]);
		setGalleryLinkDraft('');
		setGalleryEditIndex(null);
		setGalleryEditUrl('');
		setGalleryUploadTargetIndex(null);
		const avail = getStoreStockAvailable(p.stock);
		setForm({
			name: p.name || '',
			slug: p.slug || '',
			shortDescription: p.shortDescription || '',
			descriptionHtml: p.descriptionHtml || '',
			price: p.price ?? 0,
			currency: typeof p.currency === 'string' ? p.currency : '',
			trackStock: avail !== null,
			stockCount: avail ?? 0,
			priceTiers: Array.isArray(p.priceTiers)
				? p.priceTiers.map((t: any) => ({
						minQty: Math.max(2, Math.floor(Number(t.minQty) || 2)),
						unitPrice: Number(t.unitPrice) || 0,
						applyMultiples: !!t.applyMultiples,
					}))
				: [],
			thumbnail: p.thumbnail || '',
			thumbnailSource: p.thumbnailSource === 'gdrive' ? 'gdrive' : 'local',
			thumbnailGdriveFileId: p.thumbnailGdriveFileId || '',
			gallery: normalizeGalleryList(Array.isArray(p.gallery) ? p.gallery : []),
			videoUrl: p.videoUrl || '',
			whatsappPhoneOverride: p.whatsappPhoneOverride || '',
			whatsappContactNameOverride: p.whatsappContactNameOverride || '',
			buyMessageTemplateOverride: p.buyMessageTemplateOverride || '',
			storeAddressOverride: p.storeAddressOverride || '',
			published: !!p.published,
			categoryId: p.categoryId
				? String(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId)
				: '',
		});
		setProductOpen(true);
	};

	const createCategoryMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest('POST', categoriesUrl, { name: newCategoryName.trim() });
			return res.json() as Promise<{ _id: string }>;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [categoriesUrl] });
			queryClient.invalidateQueries({ queryKey: [publicProductsKey] });
			setForm((f) => ({ ...f, categoryId: String(data._id) }));
			setNewCategoryName('');
			setNewCategoryOpen(false);
			toast({ title: 'Kategori dibuat' });
		},
		onError: () => toast({ title: 'Gagal membuat kategori', variant: 'destructive' }),
	});

	const saveProductMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				...form,
				price: Number(form.price),
				currency: form.currency?.trim() ? normalizeStoreCurrency(form.currency) : '',
				gallery: normalizeGalleryList(form.gallery || []),
				stock: form.trackStock ? Math.max(0, Math.floor(Number(form.stockCount))) : -1,
				priceTiers: normalizePriceTiersInput(form.priceTiers),
				categoryId: form.categoryId?.trim() ? form.categoryId.trim() : null,
			};
			delete (payload as any).trackStock;
			delete (payload as any).stockCount;
			delete (payload as any).priceTierMultiples;
			if (editingId) {
				return apiRequest('PATCH', `${productsUrl}/${editingId}`, payload);
			}
			return apiRequest('POST', productsUrl, payload);
		},
		onSuccess: async () => {
			const activeUrls = new Set(getStoreLikeUrls(form));
			const orphanUploads = sessionUploadedUrls.filter((u) => !activeUrls.has(u));
			if (orphanUploads.length) await cleanupStoreUploads(orphanUploads);
			setSessionUploadedUrls([]);
			queryClient.invalidateQueries({ queryKey: ['store-admin-products'] });
			queryClient.invalidateQueries({ queryKey: [publicProductsKey] });
			setProductOpen(false);
			toast({ title: editingId ? 'Produk diperbarui' : 'Produk dibuat' });
		},
		onError: (err: Error) =>
			toast({ title: err.message || 'Gagal menyimpan produk', variant: 'destructive' }),
	});

	const deleteProductMutation = useMutation({
		mutationFn: (id: string) => apiRequest('DELETE', `${productsUrl}/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['store-admin-products'] });
			toast({ title: 'Produk dihapus' });
		},
	});

	const reorderProductsMutation = useMutation({
		mutationFn: (orderedIds: string[]) =>
			apiRequest('PATCH', productsReorderUrl, { orderedIds }).then((r) => {
				if (!r.ok) throw new Error('reorder');
			}),
		onSuccess: () => {
			reorderInitRef.current = false;
			queryClient.invalidateQueries({ queryKey: ['store-admin-products'] });
			queryClient.invalidateQueries({ queryKey: [publicProductsKey] });
			toast({ title: 'Urutan produk disimpan' });
		},
		onError: () => toast({ title: 'Gagal menyimpan urutan', variant: 'destructive' }),
	});

	const onProductGridDragEnd = (e: DragEndEvent) => {
		const { active, over } = e;
		if (!over || active.id === over.id) return;
		const ids = reorderIds.length ? reorderIds : products.map((p: any) => String(p._id));
		const oldIndex = ids.indexOf(String(active.id));
		const newIndex = ids.indexOf(String(over.id));
		if (oldIndex < 0 || newIndex < 0) return;
		const next = arrayMove(ids, oldIndex, newIndex);
		setReorderIds(next);
		reorderProductsMutation.mutate(next);
	};

	const [categoryToDelete, setCategoryToDelete] = useState<{ _id: string; name: string } | null>(null);

	const deleteCategoryMutation = useMutation({
		mutationFn: (id: string) => apiRequest('DELETE', `${categoriesUrl}/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [categoriesUrl] });
			queryClient.invalidateQueries({ queryKey: ['store-admin-products'] });
			queryClient.invalidateQueries({ queryKey: [publicProductsKey] });
			setCategoryToDelete(null);
			toast({ title: 'Kategori dihapus' });
		},
		onError: () => toast({ title: 'Gagal menghapus kategori', variant: 'destructive' }),
	});

	const updateOrderStatusMutation = useMutation({
		mutationFn: ({ orderNo, status }: { orderNo: string; status: string }) =>
			apiRequest('PATCH', `${ordersUrl}/${encodeURIComponent(orderNo)}`, { status }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ordersUrl] });
			toast({ title: 'Status pesanan diperbarui' });
		},
		onError: () => toast({ title: 'Gagal memperbarui status', variant: 'destructive' }),
	});

	const [orderNoToDelete, setOrderNoToDelete] = useState<string | null>(null);
	const [deleteAllOpen, setDeleteAllOpen] = useState(false);
	const [deleteAllPhrase, setDeleteAllPhrase] = useState('');

	const deleteOrderMutation = useMutation({
		mutationFn: (orderNo: string) =>
			apiRequest('DELETE', `${ordersUrl}/${encodeURIComponent(orderNo)}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ordersUrl] });
			setOrderNoToDelete(null);
			toast({ title: 'Pesanan dihapus' });
		},
		onError: () => toast({ title: 'Gagal menghapus pesanan', variant: 'destructive' }),
	});

	const deleteAllOrdersMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest('DELETE', ordersUrl, { confirm: true });
			return res.json() as Promise<{ ok?: boolean; deletedCount?: number }>;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [ordersUrl] });
			setDeleteAllOpen(false);
			setDeleteAllPhrase('');
			toast({
				title: 'Riwayat pesanan dikosongkan',
				description:
					typeof data.deletedCount === 'number'
						? `${data.deletedCount} pesanan dihapus permanen.`
						: undefined,
			});
		},
		onError: () => toast({ title: 'Gagal menghapus semua pesanan', variant: 'destructive' }),
	});

	const [shareProductId, setShareProductId] = useState<string | null>(null);
	const [shareUsername, setShareUsername] = useState('');
	const [shareLevel, setShareLevel] = useState<'view' | 'edit'>('view');

	const { data: shares = [] } = useQuery({
		queryKey: [productsUrl, shareProductId, 'shares'],
		queryFn: async () => {
			const res = await fetch(`${productsUrl}/${shareProductId}/shares`, {
				credentials: 'include',
			});
			if (!res.ok) return [];
			return res.json();
		},
		enabled: !!shareProductId && canManage,
	});

	const addShareMutation = useMutation({
		mutationFn: () =>
			apiRequest('POST', `${productsUrl}/${shareProductId}/shares`, {
				username: shareUsername.trim().toLowerCase(),
				accessLevel: shareLevel,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [productsUrl, shareProductId, 'shares'] });
			setShareUsername('');
			toast({ title: 'Sharing ditambahkan' });
		},
		onError: () => toast({ title: 'Gagal menambah sharing', variant: 'destructive' }),
	});

	const deleteShareMutation = useMutation({
		mutationFn: (id: string) => apiRequest('DELETE', `${adminSharesBase}/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [productsUrl, shareProductId, 'shares'] });
			toast({ title: 'Sharing dihapus' });
		},
	});

	const uploadStoreImage = async (file: File) => {
		const fd = new FormData();
		fd.append('image', file);
		const res = await apiRequest('POST', storeUploadImageUrl, fd);
		const data = (await res.json()) as { url: string };
		if (data.url?.startsWith('/uploads/')) {
			setSessionUploadedUrls((prev) => Array.from(new Set([...prev, data.url])));
		}
		return data.url;
	};

	const toGalleryItem = (urlRaw: string) => {
		const url = String(urlRaw || '').trim();
		return {
			url,
			source: url.includes('drive.google.com') ? ('gdrive' as const) : ('local' as const),
			gdriveFileId: '',
		};
	};

	const appendGalleryFromLinks = (urls: string[]) => {
		setForm((f) => {
			const valid = urls.map((u) => u.trim()).filter(Boolean);
			const next = [...f.gallery, ...valid.map((u) => toGalleryItem(u))].slice(0, 10);
			return { ...f, gallery: next };
		});
	};

	const taxPreview = useMemo(() => {
		const sub = 100000;
		const pct = s?.taxEnabled ? Number(s?.taxPercent || 0) : 0;
		const cur = normalizeStoreCurrency(s?.defaultCurrency);
		return {
			sub,
			tax: Math.round((sub * pct) / 100),
			total: sub + Math.round((sub * pct) / 100),
			cur,
		};
	}, [s]);

	const tokoPageDataForSpyro = useMemo(
		() =>
			buildTokoSpyroPageData({
				permissionsLoading: accessLoading,
				canManage,
				activeTab: tokoTab,
				productDialogOpen: productOpen,
				editingProductId: editingId,
				editingProductName: editingId
					? (products as { _id: string; name?: string }[]).find((p) => p._id === editingId)?.name ||
						form.name
					: form.name,
			}),
		[accessLoading, canManage, tokoTab, productOpen, editingId, products, form.name],
	);

	if (accessLoading || !access?.canOpenDashboard) {
		return (
			<DashboardLayout title="Toko" pageContextExtra={{ pageData: tokoPageDataForSpyro }}>
				<div className="flex justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout title="Toko" pageContextExtra={{ pageData: tokoPageDataForSpyro }}>
			<div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
							<ShoppingBag className="h-7 w-7 text-primary" />
							Toko & Katalog
						</h1>
						<p className="text-muted-foreground text-sm mt-1">
							Kelola tampilan toko, produk, pajak, WhatsApp, dan sharing per produk.
						</p>
					</div>
					{canManage && (
						<Button onClick={openNewProduct}>
							<Plus className="h-4 w-4 mr-2" />
							Produk baru
						</Button>
					)}
				</div>

				<DashboardHintCard
					key={tokoTab}
					title={
						tokoTab === 'products'
							? 'Panduan tab Produk'
							: tokoTab === 'settings'
								? 'Panduan tab Pengaturan toko'
								: tokoTab === 'orders'
									? 'Panduan tab Pesanan'
									: 'Panduan tab Kategori'
					}
					description="Petunjuk ini berubah mengikuti tab yang aktif. Status buka/tutup disimpan per tab."
					variant="blue"
					storageKey={`dashboard-toko-hint-${tokoTab}`}
					defaultOpen>
					<div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
						{tokoTab === 'products' && (
							<>
								<section>
									<p className="font-semibold text-foreground mb-1">Menambah katalog baru</p>
									<ol className="list-decimal pl-5 space-y-1">
										<li>
											Pastikan Anda punya izin pengelola (<strong>toko.manage</strong>) atau hanya
											produk yang dibagikan ke Anda.
										</li>
										<li>
											Klik <strong>Produk baru</strong>, isi nama, harga, ringkasan, dan deskripsi.
											<strong> Thumbnail</strong> wajib; galeri & video (YouTube / Google Drive)
											opsional.
										</li>
										<li>
											<strong>Simpan</strong> di dialog. <strong>Draft</strong> = belum tampil di
											toko publik; <strong>Publik</strong> jika siap.
										</li>
									</ol>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Mengedit, hapus, urutan grid</p>
									<ul className="list-disc pl-5 space-y-1">
										<li>
											<strong>Edit</strong> dari tabel; <strong>Hapus</strong> hanya pengelola
											(tidak otomatis undo).
										</li>
										<li>
											Mode <strong>urutkan</strong> pada grid mengubah urutan tampilan di halaman
											toko — berbeda dari urutan blok layout di tab Pengaturan.
										</li>
									</ul>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">WhatsApp per produk</p>
									<p>
										Di form produk bisa override nomor/template WA; kosongkan untuk memakai
										pengaturan global (tab Pengaturan).
									</p>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Jika gagal simpan</p>
									<ul className="list-disc pl-5 space-y-1">
										<li>Wajib: nama, harga valid, thumbnail.</li>
										<li>Video selain YouTube/Drive ditolak.</li>
									</ul>
								</section>
							</>
						)}
						{tokoTab === 'settings' && canManage && (
							<>
								<section>
									<p className="font-semibold text-foreground mb-1">Tampilan navbar & beranda situs</p>
									<ul className="list-disc pl-5 space-y-1">
										<li>
											<strong>Label</strong> dan <strong>path</strong> menu toko di navbar publik
											(mis. tautan ke katalog).
										</li>
										<li>
											Blok <strong>layout halaman /toko</strong>: geser kartu dengan grip (⋮⋮);
											hanya mengubah halaman toko publik, bukan urutan baris di tab Produk.
										</li>
									</ul>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">WhatsApp & pesan</p>
									<p>
										Nomor admin global dan template pesan (beli satuan / checkout keranjang).
										Format nomor tanpa <code className="text-xs">+</code>, contoh{' '}
										<code className="text-xs">62812xxxx</code>.
									</p>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Pajak & mata uang</p>
									<p>Aktifkan pajak persen bila perlu; mata uang default memengaruhi tampilan harga.</p>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Simpan per bagian</p>
									<p>Setelah mengubah pajak, WA, atau layout, gunakan tombol simpan di area yang sama.</p>
								</section>
							</>
						)}
						{tokoTab === 'orders' && canManage && (
							<>
								<section>
									<p className="font-semibold text-foreground mb-1">Pesanan terbaru</p>
									<p>
										Daftar pesanan menampilkan nomor order, waktu, dan pembeli. Dropdown{' '}
										<strong>Status</strong>: alur disarankan{' '}
										<strong>Menunggu → Dibayar → Dikonfirmasi → Diterima</strong>, atau{' '}
										<strong>Dibatalkan</strong>. Progress di invoice pembeli memakai 4 langkah
										tersebut.
									</p>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Menghapus riwayat</p>
									<ul className="list-disc pl-5 space-y-1">
										<li>
											Ikon tempat sampah pada kartu: hapus <strong>satu</strong> pesanan permanen.
										</li>
										<li>
											<strong>Hapus semua riwayat</strong>: ketik frasa konfirmasi di dialog —
											semua pesanan di toko ini dihapus dari database.
										</li>
									</ul>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Tips</p>
									<ul className="list-disc pl-5 space-y-1">
										<li>Status sebaiknya mengikuti keadaan riil pembayaran & pengiriman.</li>
										<li>Pembeli dapat memantau lewat tautan invoice / halaman status jika tersedia.</li>
									</ul>
								</section>
							</>
						)}
						{tokoTab === 'categories' && canManage && (
							<>
								<section>
									<p className="font-semibold text-foreground mb-1">Kategori produk</p>
									<p>
										Buat nama kategori untuk mengelompokkan produk di katalog. Produk mengait ke
										kategori lewat form <strong>Edit</strong> di tab Produk.
									</p>
								</section>
								<section>
									<p className="font-semibold text-foreground mb-1">Menghapus</p>
									<p>
										Hapus kategori hanya jika tidak lagi dipakai; pertimbangkan mengosongkan kategori
										di produk terlebih dahulu.
									</p>
								</section>
							</>
						)}
					</div>
				</DashboardHintCard>

				<Tabs value={tokoTab} onValueChange={setTokoTab} className="w-full">
					<TabsList className="flex flex-wrap h-auto gap-1">
						<TabsTrigger value="products" className="gap-2">
							<Package className="h-4 w-4" />
							Produk
						</TabsTrigger>
						<TabsTrigger value="settings" className="gap-2" disabled={!canManage}>
							<Settings2 className="h-4 w-4" />
							Pengaturan toko
						</TabsTrigger>
						{canManage && (
							<TabsTrigger value="orders" className="gap-2">
								<ShoppingBag className="h-4 w-4" />
								Pesanan
							</TabsTrigger>
						)}
						{canManage && (
							<TabsTrigger value="categories" className="gap-2">
								<Tag className="h-4 w-4" />
								Kategori
							</TabsTrigger>
						)}
					</TabsList>

					<TabsContent value="products" className="mt-6">
						<Card>
							<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<CardTitle>Daftar produk</CardTitle>
									<CardDescription>
										{canManage
											? 'Grid mengikuti tampilan toko publik. Maksimal 9 produk per halaman; atur urutan untuk semua produk sekaligus.'
											: 'Produk yang dapat Anda akses.'}
									</CardDescription>
								</div>
								{canManage && products.length > 0 && (
									<div className="flex flex-wrap gap-2 shrink-0">
										{reorderMode ? (
											<Button
												type="button"
												variant="secondary"
												disabled={reorderProductsMutation.isPending}
												onClick={() => {
													setReorderMode(false);
													setProductPage(1);
												}}>
												Selesai atur urutan
											</Button>
										) : (
											<Button type="button" variant="outline" onClick={() => setReorderMode(true)}>
												Atur urutan grid
											</Button>
										)}
									</div>
								)}
							</CardHeader>
							<CardContent>
								{productsLoading ? (
									<Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />
								) : products.length === 0 ? (
									<p className="text-muted-foreground text-center py-8">Belum ada produk.</p>
								) : reorderMode && canManage ? (
									<DndContext
										sensors={productGridSensors}
										collisionDetection={closestCenter}
										onDragEnd={onProductGridDragEnd}>
										<SortableContext
											items={
												reorderIds.length
													? reorderIds
													: products.map((p: any) => String(p._id))
											}
											strategy={rectSortingStrategy}>
											<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
												{displayProducts.map((p: any) => (
													<DashboardSortableProductCard
														key={p._id}
														id={String(p._id)}
														reorderMode={reorderMode}>
														{(dragHandle) => (
															<Card className="h-full overflow-hidden relative hover:border-primary/40 transition-colors">
																{dragHandle}
																<Link
																	href={prefixPub(`${publicStoreBasePath}/${p.slug}`)}
																	className="block aspect-[4/3] bg-muted relative overflow-hidden">
																	<MediaDisplay
																		src={p.thumbnail}
																		alt={p.name}
																		className="w-full h-full object-cover"
																	/>
																</Link>
																<CardContent className="p-4 space-y-2">
																	<Link
																		href={prefixPub(`${publicStoreBasePath}/${p.slug}`)}
																		className="font-semibold line-clamp-2 hover:text-primary block">
																		{p.name}
																	</Link>
																	{p.categoryId &&
																		typeof p.categoryId === 'object' &&
																		(p.categoryId as { name?: string }).name && (
																			<p className="text-xs text-muted-foreground">
																				{(p.categoryId as { name: string }).name}
																			</p>
																		)}
																	<p className="text-primary font-bold">
																		{formatStoreMoney(
																			p.price,
																			effectiveProductCurrency(p, defaultStoreCurrency),
																		)}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		Stok:{' '}
																		{getStoreStockAvailable(p.stock) === null
																			? '—'
																			: getStoreStockAvailable(p.stock)}
																		{' · '}
																		{p.published ? (
																			<span className="text-emerald-600">Publik</span>
																		) : (
																			<span>Draft</span>
																		)}
																	</p>
																	<div className="flex flex-wrap gap-2 pt-1">
																		<Button variant="outline" size="sm" onClick={() => openEdit(p)}>
																			Edit
																		</Button>
																		<Button
																			variant="secondary"
																			size="sm"
																			onClick={() => setShareProductId(p._id)}>
																			<Share2 className="h-4 w-4" />
																		</Button>
																		<Button
																			variant="ghost"
																			size="sm"
																			className="text-destructive"
																			onClick={() => {
																				if (confirm('Hapus produk ini?'))
																					deleteProductMutation.mutate(p._id);
																			}}>
																			<Trash2 className="h-4 w-4" />
																		</Button>
																	</div>
																</CardContent>
															</Card>
														)}
													</DashboardSortableProductCard>
												))}
											</div>
										</SortableContext>
									</DndContext>
								) : (
									<>
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
											{displayProducts.map((p: any) => (
												<Card
													key={p._id}
													className="h-full overflow-hidden hover:border-primary/40 transition-colors group">
													<Link
														href={prefixPub(`${publicStoreBasePath}/${p.slug}`)}
														className="block aspect-[4/3] bg-muted relative overflow-hidden">
														<MediaDisplay
															src={p.thumbnail}
															alt={p.name}
															className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
														/>
													</Link>
													<CardContent className="p-4 space-y-2">
														<Link
															href={prefixPub(`${publicStoreBasePath}/${p.slug}`)}
															className="font-semibold line-clamp-2 hover:text-primary block">
															{p.name}
														</Link>
														{p.categoryId &&
															typeof p.categoryId === 'object' &&
															(p.categoryId as { name?: string }).name && (
																<p className="text-xs text-muted-foreground">
																	{(p.categoryId as { name: string }).name}
																</p>
															)}
														<p className="text-primary font-bold">
															{formatStoreMoney(
																p.price,
																effectiveProductCurrency(p, defaultStoreCurrency),
															)}
														</p>
														<p className="text-xs text-muted-foreground">
															Stok:{' '}
															{getStoreStockAvailable(p.stock) === null
																? '—'
																: getStoreStockAvailable(p.stock)}
															{' · '}
															{p.published ? (
																<span className="text-emerald-600">Publik</span>
															) : (
																<span>Draft</span>
															)}
														</p>
														<div className="flex flex-wrap gap-2 pt-1">
															<Button variant="outline" size="sm" onClick={() => openEdit(p)}>
																Edit
															</Button>
															{canManage && (
																<Button
																	variant="secondary"
																	size="sm"
																	onClick={() => setShareProductId(p._id)}>
																	<Share2 className="h-4 w-4" />
																</Button>
															)}
															{canManage && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="text-destructive"
																	onClick={() => {
																		if (confirm('Hapus produk ini?'))
																			deleteProductMutation.mutate(p._id);
																	}}>
																	<Trash2 className="h-4 w-4" />
																</Button>
															)}
														</div>
													</CardContent>
												</Card>
											))}
										</div>
										{adminTotalPages > 1 && (
											<div className="flex items-center justify-center gap-4 mt-8">
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={productPage <= 1}
													onClick={() => setProductPage((pg) => Math.max(1, pg - 1))}>
													<ChevronLeft className="h-4 w-4 mr-1" />
													Sebelumnya
												</Button>
												<span className="text-sm text-muted-foreground tabular-nums">
													Halaman {productPage} / {adminTotalPages}
												</span>
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={productPage >= adminTotalPages}
													onClick={() =>
														setProductPage((pg) => Math.min(adminTotalPages, pg + 1))
													}>
													Selanjutnya
													<ChevronRight className="h-4 w-4 ml-1" />
												</Button>
											</div>
										)}
									</>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="settings" className="mt-6 space-y-6">
						{settingsLoading || !s ? (
							<Loader2 className="h-8 w-8 animate-spin mx-auto" />
						) : (
							<>
								<Card>
									<CardHeader>
										<CardTitle>Navbar & kontak</CardTitle>
										<CardDescription>Label dan path menu publik, serta WhatsApp admin.</CardDescription>
									</CardHeader>
									<CardContent className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label>Label menu</Label>
											<Input
												value={s.navbarLabel}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														navbarLabel: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Path (mis. /toko)</Label>
											<Input
												value={s.navbarPath}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														navbarPath: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Nomor WhatsApp (tanpa +, contoh 62812...)</Label>
											<Input
												value={s.whatsappPhone}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														whatsappPhone: e.target.value,
													}))
												}
												placeholder="6281234567890"
											/>
										</div>
										<div className="space-y-2">
											<Label>Nama kontak (opsional)</Label>
											<Input
												value={s.whatsappContactName || ''}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														whatsappContactName: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Mata uang default katalog (ISO, mis. IDR)</Label>
											<select
												className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
												value={normalizeStoreCurrency(s.defaultCurrency)}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														defaultCurrency: e.target.value,
													}))
												}>
												{COMMON_CURRENCIES.map((code) => (
													<option key={code} value={code}>
														{code}
													</option>
												))}
											</select>
											<p className="text-xs text-muted-foreground">
												Dipakai jika produk tidak mengatur override mata uang sendiri.
											</p>
										</div>
										<div className="sm:col-span-2 space-y-2">
											<Label>Alamat toko (global)</Label>
											<Textarea
												value={s.storeAddress || ''}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														storeAddress: e.target.value,
													}))
												}
												rows={2}
												placeholder="Contoh: Jl. Ganesha No. 10, Bandung — untuk ditampilkan di pesan ambil di tempat"
											/>
										</div>
										<div className="sm:col-span-2">
											<Button
												type="button"
												disabled={saveSettingsMutation.isPending}
												onClick={() => saveSettingsMutation.mutate(settingsDraft)}>
												Simpan navbar & kontak
											</Button>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle>Pajak & pesan WhatsApp</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex items-center gap-3">
											<Switch
												checked={!!s.taxEnabled}
												onCheckedChange={(v) =>
													setSettingsDraft((prev: any) => ({ ...prev, taxEnabled: v }))
												}
											/>
											<span>Aktifkan pajak</span>
										</div>
										<div className="space-y-2 max-w-xs">
											<Label>Persen pajak</Label>
											<Input
												type="number"
												min={0}
												value={s.taxPercent ?? 0}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														taxPercent: parseFloat(e.target.value) || 0,
													}))
												}
											/>
										</div>
										<p className="text-sm text-muted-foreground">
											Simulasi ({formatStoreMoney(100000, taxPreview.cur)}): pajak{' '}
											{formatStoreMoney(taxPreview.tax, taxPreview.cur)} → total{' '}
											{formatStoreMoney(taxPreview.total, taxPreview.cur)}
										</p>
										<div className="space-y-2">
											<Label>Template pesan beli satuan (placeholder: {'{{productName}}'} {'{{price}}'}{' '}
												{'{{qty}}'} {'{{url}}'})
											</Label>
											<Textarea
												rows={4}
												value={s.defaultBuyMessageTemplate || ''}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														defaultBuyMessageTemplate: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Template checkout keranjang (placeholder: {'{{items}}'} {'{{subtotal}}'}{' '}
												{'{{tax}}'} {'{{total}}'} {'{{fulfillment}}'} {'{{address}}'} {'{{customerName}}'}{' '}
												{'{{customerPhone}}'})
											</Label>
											<Textarea
												rows={6}
												value={s.checkoutMessageTemplate || ''}
												onChange={(e) =>
													setSettingsDraft((prev: any) => ({
														...prev,
														checkoutMessageTemplate: e.target.value,
													}))
												}
											/>
										</div>
										<Button
											type="button"
											disabled={saveSettingsMutation.isPending}
											onClick={() => saveSettingsMutation.mutate(settingsDraft)}>
											Simpan pajak & template pesan
										</Button>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle>Layout beranda toko</CardTitle>
										<CardDescription>
											Seret untuk mengurutkan blok. Nonaktifkan blok yang tidak dipakai.
										</CardDescription>
									</CardHeader>
									<CardContent>
										<DndContext
											sensors={sensors}
											collisionDetection={closestCenter}
											onDragEnd={onLayoutDragEnd}>
											<SortableContext
												items={layoutBlocks.map((b) => b.id)}
												strategy={verticalListSortingStrategy}>
												<div className="space-y-2">
													{layoutBlocks.map((block) => (
														<SortableBlock key={block.id} id={block.id}>
															{() => (
																<div className="space-y-2">
																	<div className="flex items-center justify-between gap-2">
																		<span className="font-medium capitalize">
																			{block.type === 'hero'
																				? 'Hero'
																				: block.type === 'product_grid'
																					? 'Grid produk'
																					: block.type}
																		</span>
																		<div className="flex items-center gap-2">
																			<Label className="text-xs">Tampil</Label>
																			<Switch
																				checked={block.visible !== false}
																				onCheckedChange={(v) => {
																					const next = layoutBlocks.map((b) =>
																						b.id === block.id ? { ...b, visible: v } : b,
																					);
																					setLayoutBlocks(next);
																				}}
																			/>
																		</div>
																	</div>
																	{block.type === 'hero' && (
																		<div className="grid sm:grid-cols-2 gap-2">
																			<Input
																				placeholder="Judul"
																				value={String(block.props?.title || '')}
																				onChange={(e) => {
																					const next = layoutBlocks.map((b) =>
																						b.id === block.id
																							? {
																									...b,
																									props: {
																										...b.props,
																										title: e.target.value,
																									},
																								}
																							: b,
																					);
																					setLayoutBlocks(next);
																				}}
																			/>
																			<Input
																				placeholder="Subjudul"
																				value={String(block.props?.subtitle || '')}
																				onChange={(e) => {
																					const next = layoutBlocks.map((b) =>
																						b.id === block.id
																							? {
																									...b,
																									props: {
																										...b.props,
																										subtitle: e.target.value,
																									},
																								}
																							: b,
																					);
																					setLayoutBlocks(next);
																				}}
																			/>
																		</div>
																	)}
																</div>
															)}
														</SortableBlock>
													))}
												</div>
											</SortableContext>
										</DndContext>
										<Button
											className="mt-4"
											type="button"
											onClick={() =>
												saveSettingsMutation.mutate({
													...settingsDraft,
													layoutBlocks,
												})
											}
											disabled={saveSettingsMutation.isPending}>
											Simpan layout
										</Button>
									</CardContent>
								</Card>
							</>
						)}
					</TabsContent>

					<TabsContent value="orders" className="mt-6">
						<Card>
							<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
								<CardTitle>Pesanan terbaru</CardTitle>
								{orders.length > 0 && (
									<Button
										variant="destructive"
										size="sm"
										className="shrink-0 w-full sm:w-auto"
										onClick={() => {
											setDeleteAllPhrase('');
											setDeleteAllOpen(true);
										}}>
										Hapus semua riwayat
									</Button>
								)}
							</CardHeader>
							<CardContent>
								{orders.length === 0 ? (
									<p className="text-muted-foreground text-center py-6">Belum ada pesanan.</p>
								) : (
									<div className="overflow-x-auto text-sm space-y-4">
										{orders.map((o: any) => (
											<div key={o._id} className="border rounded-lg p-3 space-y-2">
												<div className="flex flex-wrap items-start justify-between gap-2">
													<div className="font-semibold">{o.orderNo}</div>
													<Button
														type="button"
														variant="outline"
														size="icon"
														className="h-8 w-8 shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
														aria-label="Hapus pesanan"
														onClick={() => setOrderNoToDelete(o.orderNo)}>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
												<div className="text-muted-foreground">
													{new Date(o.createdAt).toLocaleString('id-ID')} · {o.customerName} ·{' '}
													{o.customerPhone}
												</div>
												<div className="flex flex-wrap items-center gap-2">
													<span className="text-sm shrink-0">Status</span>
													<Select
														value={o.status}
														disabled={updateOrderStatusMutation.isPending}
														onValueChange={(status) =>
															updateOrderStatusMutation.mutate({
																orderNo: o.orderNo,
																status,
															})
														}>
														<SelectTrigger className="w-[200px] h-9">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="pending">Menunggu</SelectItem>
															<SelectItem value="paid">Dibayar</SelectItem>
															<SelectItem value="confirmed">Dikonfirmasi</SelectItem>
															<SelectItem value="completed">Diterima</SelectItem>
															<SelectItem value="cancelled">Dibatalkan</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div>
													Total: {formatStoreMoney(o.total, defaultStoreCurrency)}
												</div>
												<div className="text-xs whitespace-pre-wrap bg-muted/50 rounded p-2 max-h-32 overflow-auto">
													{o.whatsappMessageSnapshot}
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{canManage && (
						<TabsContent value="categories" className="mt-6">
							<Card>
								<CardHeader>
									<CardTitle>Kelola kategori</CardTitle>
									<CardDescription>
										Hapus kategori akan melepaskan produk dari kategori tersebut (tidak menghapus
										produk). Buat kategori baru lewat tombol di bawah atau dari form produk.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<Button type="button" variant="outline" size="sm" onClick={() => setNewCategoryOpen(true)}>
										<Plus className="h-4 w-4 mr-1" />
										Tambah kategori
									</Button>
									{storeCategories.length === 0 ? (
										<p className="text-muted-foreground text-sm py-4">Belum ada kategori.</p>
									) : (
										<div className="overflow-x-auto border rounded-lg">
											<table className="w-full text-sm">
												<thead>
													<tr className="border-b bg-muted/40 text-left">
														<th className="p-3 font-medium">Nama</th>
														<th className="p-3 font-medium">Slug</th>
														<th className="p-3 w-24" />
													</tr>
												</thead>
												<tbody>
													{storeCategories.map((c) => (
														<tr key={c._id} className="border-b last:border-0">
															<td className="p-3">{c.name}</td>
															<td className="p-3 text-muted-foreground font-mono text-xs">{c.slug}</td>
															<td className="p-3">
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="text-destructive"
																	onClick={() => setCategoryToDelete({ _id: c._id, name: c.name })}>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					)}
				</Tabs>
			</div>

			<AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
						<AlertDialogDescription>
							Kategori &quot;{categoryToDelete?.name}&quot; akan dihapus. Produk yang memakainya akan
							ditetapkan tanpa kategori.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => categoryToDelete && deleteCategoryMutation.mutate(categoryToDelete._id)}>
							Hapus
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={!!orderNoToDelete} onOpenChange={(open) => !open && setOrderNoToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Hapus pesanan ini?</AlertDialogTitle>
						<AlertDialogDescription>
							Pesanan <span className="font-mono font-medium">{orderNoToDelete}</span> akan dihapus permanen
							dari database. Tindakan ini tidak bisa dibatalkan.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleteOrderMutation.isPending}
							onClick={() => orderNoToDelete && deleteOrderMutation.mutate(orderNoToDelete)}>
							Hapus
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={deleteAllOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteAllPhrase('');
						setDeleteAllOpen(false);
					}
				}}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Hapus semua riwayat pesanan?</AlertDialogTitle>
						<AlertDialogDescription className="space-y-3">
							<span>
								Semua pesanan di toko ini akan dihapus permanen dari database (termasuk data invoice
								publik). Ketik <strong>HAPUS SEMUA</strong> untuk melanjutkan.
							</span>
							<Input
								value={deleteAllPhrase}
								onChange={(e) => setDeleteAllPhrase(e.target.value)}
								placeholder="HAPUS SEMUA"
								autoComplete="off"
							/>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={
								deleteAllOrdersMutation.isPending || deleteAllPhrase.trim() !== 'HAPUS SEMUA'
							}
							onClick={() => deleteAllOrdersMutation.mutate()}>
							Hapus semua
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={productOpen}
				onOpenChange={(open) => {
					if (!open) {
						void closeProductDialog();
						return;
					}
					setProductOpen(true);
				}}>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{editingId ? 'Edit produk' : 'Produk baru'}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="grid sm:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Nama</Label>
								<Input
									value={form.name}
									onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								/>
							</div>
							{canManage && (
								<div className="space-y-2">
									<Label>Slug</Label>
									<Input
										value={form.slug}
										onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
										placeholder="otomatis dari nama jika kosong"
									/>
								</div>
							)}
						</div>
						<div className="space-y-2">
							<Label>Deskripsi singkat</Label>
							<Textarea
								value={form.shortDescription}
								onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
								rows={2}
							/>
						</div>
						<div className="space-y-2">
							<Label>Deskripsi lengkap</Label>
							<RichTextEditor
								value={form.descriptionHtml}
								onChange={(html) => setForm((f) => ({ ...f, descriptionHtml: html }))}
								height={280}
							/>
						</div>
						<div className="grid sm:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Harga ({effectiveFormCurrency})</Label>
								<Input
									inputMode="decimal"
									value={formatAmountForInput(form.price, effectiveFormCurrency)}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											price: parseAmountInput(e.target.value, effectiveFormCurrency),
										}))
									}
								/>
								<p className="text-xs text-muted-foreground">
									Ketik angka; pemisah ribuan akan mengikuti locale mata uang (mis. 1.000 untuk IDR).
								</p>
							</div>
							<div className="space-y-2">
								<Label>Override mata uang (opsional)</Label>
								<select
									className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									value={form.currency?.trim() ? normalizeStoreCurrency(form.currency) : ''}
									onChange={(e) =>
										setForm((f) => ({ ...f, currency: e.target.value }))
									}>
									<option value="">
										Ikuti default toko ({defaultStoreCurrency})
									</option>
									{COMMON_CURRENCIES.map((code) => (
										<option key={code} value={code}>
											{code}
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Kategori</Label>
							<div className="flex flex-col sm:flex-row gap-2">
								<select
									className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"
									value={form.categoryId}
									onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
									<option value="">Tanpa kategori</option>
									{storeCategories.map((c) => (
										<option key={c._id} value={c._id}>
											{c.name}
										</option>
									))}
								</select>
								{canManage && (
									<Button
										type="button"
										variant="outline"
										className="shrink-0"
										onClick={() => {
											setNewCategoryName('');
											setNewCategoryOpen(true);
										}}>
										Kategori baru
									</Button>
								)}
							</div>
						</div>
						<div className="grid sm:grid-cols-2 gap-4 items-end">
							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Label>Stok</Label>
									<div className="flex items-center gap-2">
										<Switch
											checked={form.trackStock}
											onCheckedChange={(v) =>
												setForm((f) => ({ ...f, trackStock: v, stockCount: v ? Math.max(0, f.stockCount) : 0 }))
											}
										/>
										<span className="text-xs text-muted-foreground">Batasi stok</span>
									</div>
								</div>
								{form.trackStock ? (
									<Input
										type="number"
										min={0}
										inputMode="numeric"
										value={form.stockCount}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												stockCount: Math.max(0, parseInt(e.target.value, 10) || 0),
											}))
										}
									/>
								) : (
									<p className="text-sm text-muted-foreground">Tak terbatas (tidak dikurangi otomatis)</p>
								)}
							</div>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label>Harga grosir / paket (opsional)</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										setForm((f) => ({
											...f,
											priceTiers: [
												...f.priceTiers,
												{ minQty: 2, unitPrice: 0, applyMultiples: false },
											],
										}))
									}>
									<Plus className="h-4 w-4 mr-1" />
									Tambah harga grosir
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Atur minimal jumlah dan harga satuan per baris. Centang &quot;Berlaku kelipatan&quot; per
								baris jika harga itu berlaku per kelipatan minimal (sisanya harga dasar).
							</p>
							{form.priceTiers.length > 0 && (
								<div className="space-y-3 rounded-lg border p-3">
									{form.priceTiers.map((t, i) => (
										<div key={i} className="space-y-2 rounded-md border bg-muted/15 p-3">
											<div className="flex flex-wrap items-end gap-2">
												<div className="space-y-1 flex-1 min-w-[120px]">
													<Label className="text-xs">Min. jumlah</Label>
													<Input
														type="number"
														min={2}
														value={t.minQty || ''}
														onChange={(e) => {
															const minQty = Math.max(2, parseInt(e.target.value, 10) || 2);
															setForm((f) => {
																const next = [...f.priceTiers];
																next[i] = { ...next[i], minQty };
																return { ...f, priceTiers: next };
															});
														}}
													/>
												</div>
												<div className="space-y-1 flex-1 min-w-[120px]">
													<Label className="text-xs">Harga satuan ({effectiveFormCurrency})</Label>
													<Input
														inputMode="decimal"
														value={formatAmountForInput(t.unitPrice, effectiveFormCurrency)}
														onChange={(e) => {
															const unitPrice = parseAmountInput(
																e.target.value,
																effectiveFormCurrency,
															);
															setForm((f) => {
																const next = [...f.priceTiers];
																next[i] = { ...next[i], unitPrice };
																return { ...f, priceTiers: next };
															});
														}}
													/>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="shrink-0"
													onClick={() =>
														setForm((f) => ({
															...f,
															priceTiers: f.priceTiers.filter((_, j) => j !== i),
														}))
													}>
													<Minus className="h-4 w-4" />
												</Button>
											</div>
											<div className="flex items-start gap-2 pt-1">
												<Checkbox
													id={`price-tier-mul-${i}`}
													checked={!!t.applyMultiples}
													onCheckedChange={(v) =>
														setForm((f) => {
															const next = [...f.priceTiers];
															next[i] = { ...next[i], applyMultiples: v === true };
															return { ...f, priceTiers: next };
														})
													}
												/>
												<div className="space-y-0.5">
													<Label
														htmlFor={`price-tier-mul-${i}`}
														className="text-xs font-medium cursor-pointer">
														Berlaku kelipatan (tier ini)
													</Label>
													<p className="text-[11px] text-muted-foreground leading-snug">
														Centang: kelompok penuh sesuai minimal di atas pakai harga grosir ini; sisa
														harga dasar. Tidak centang: hanya blok minimal pertama pakai harga ini.
													</p>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
						<input
							ref={thumbFileRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={async (e) => {
								const file = e.target.files?.[0];
								e.target.value = '';
								if (!file) return;
								setUploadingThumb(true);
								try {
									const oldThumb = String(form.thumbnail || '');
									const url = await uploadStoreImage(file);
									setForm((f) => ({
										...f,
										thumbnail: url,
										thumbnailSource: 'local',
										thumbnailGdriveFileId: '',
									}));
									if (oldThumb && sessionUploadedUrls.includes(oldThumb)) {
										await cleanupStoreUploads([oldThumb]);
										setSessionUploadedUrls((prev) => prev.filter((u) => u !== oldThumb));
									}
									toast({ title: 'Thumbnail diunggah' });
								} catch (err: any) {
									toast({
										title: 'Gagal mengunggah thumbnail',
										description: err?.message || 'Coba lagi beberapa saat.',
										variant: 'destructive',
									});
								} finally {
									setUploadingThumb(false);
								}
							}}
						/>
						<div className="space-y-2">
							<Label>Thumbnail utama — URL atau unggah file</Label>
							<div className="flex flex-col sm:flex-row gap-2">
								<Input
									value={form.thumbnail}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											thumbnail: e.target.value,
											thumbnailSource: e.target.value.includes('drive.google.com')
												? 'gdrive'
												: 'local',
										}))
									}
									placeholder="https://drive.google.com/file/d/xxxx/view atau https://contoh.com/gambar.jpg"
								/>
								<Button
									type="button"
									variant="secondary"
									disabled={uploadingThumb}
									onClick={() => thumbFileRef.current?.click()}>
									{uploadingThumb ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unggah gambar'}
								</Button>
							</div>
							{form.thumbnail ? (
								<div className="w-28 h-28 rounded-md border overflow-hidden bg-muted/20">
									<MediaDisplay
										src={form.thumbnail}
										alt="Thumbnail preview"
										type="image"
										className="w-full h-full object-cover"
									/>
								</div>
							) : null}
							{form.thumbnail ? (
								<p className="text-xs text-muted-foreground break-all">Saat ini: {form.thumbnail}</p>
							) : null}
						</div>
						<input
							ref={galleryFileRef}
							type="file"
							accept="image/*"
							multiple
							className="hidden"
							onChange={async (e) => {
								const pickedFiles = e.target.files ? Array.from(e.target.files) : [];
								e.target.value = '';
								if (!pickedFiles.length) return;
								const imageFiles = pickedFiles.filter((f) => isImageLikeFile(f));
								if (!imageFiles.length) {
									toast({
										title: 'File tidak didukung',
										description: 'Galeri hanya menerima file gambar.',
										variant: 'destructive',
									});
									return;
								}
								if (imageFiles.length !== pickedFiles.length) {
									toast({
										title: 'Sebagian file dilewati',
										description: 'Hanya file gambar yang diproses untuk galeri.',
										variant: 'destructive',
									});
								}
								const targetIndex = galleryUploadTargetIndex;
								setUploadingGallery(true);
								try {
									const urls: string[] = [];
									for (let i = 0; i < imageFiles.length; i += 1) {
										urls.push(await uploadStoreImage(imageFiles[i]));
									}
									setForm((f) => {
										if (targetIndex !== null && urls[0]) {
											const next = [...f.gallery];
											next[targetIndex] = { url: urls[0], source: 'local' as const };
											return { ...f, gallery: next.slice(0, 10) };
										}
										const next = [
											...f.gallery,
											...urls.map((url) => ({
												url,
												source: 'local' as const,
											})),
										].slice(0, 10);
										return { ...f, gallery: next };
									});
									if (targetIndex !== null) {
										const oldUrl = String(form.gallery[targetIndex]?.url || '');
										if (oldUrl && sessionUploadedUrls.includes(oldUrl)) {
											await cleanupStoreUploads([oldUrl]);
											setSessionUploadedUrls((prev) => prev.filter((u) => u !== oldUrl));
										}
									}
									toast({ title: `${urls.length} gambar galeri diunggah` });
								} catch (err: any) {
									toast({
										title: 'Gagal mengunggah galeri',
										description: err?.message || 'Coba lagi beberapa saat.',
										variant: 'destructive',
									});
								} finally {
									setUploadingGallery(false);
									setGalleryUploadTargetIndex(null);
								}
							}}
						/>
						<div className="space-y-2">
							<Label>Galeri (maks. 10) — tambah via link atau upload</Label>
							<div className="rounded-lg border p-3 space-y-3 bg-muted/20">
								<div className="flex flex-col sm:flex-row gap-2">
									<Input
										value={galleryLinkDraft}
										onChange={(e) => setGalleryLinkDraft(e.target.value)}
										placeholder="https://drive.google.com/file/d/abc/view atau https://cdn.contoh.com/foto.jpg"
									/>
									<Button
										type="button"
										variant="secondary"
										disabled={!galleryLinkDraft.trim() || form.gallery.length >= 10}
										onClick={() => {
											appendGalleryFromLinks([galleryLinkDraft]);
											setGalleryLinkDraft('');
										}}>
										<Link2 className="h-4 w-4 mr-2" />
										Tambah link
									</Button>
									<Button
										type="button"
										variant="outline"
										disabled={uploadingGallery || form.gallery.length >= 10}
										onClick={() => {
											setGalleryUploadTargetIndex(null);
											galleryFileRef.current?.click();
										}}>
										{uploadingGallery ? (
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
										) : (
											<Upload className="h-4 w-4 mr-2" />
										)}
										Tambah upload
									</Button>
								</div>
								{form.gallery.length === 0 ? (
									<p className="text-xs text-muted-foreground">Belum ada item galeri.</p>
								) : (
									<div className="space-y-2">
										{form.gallery.map((g, idx) => (
											<div key={`${g.url}-${idx}`} className="rounded-md border bg-background p-2">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0 flex items-start gap-3">
														<div className="w-16 h-16 rounded border overflow-hidden bg-muted/20 shrink-0">
															<MediaDisplay
																src={g.url}
																alt={`Galeri ${idx + 1}`}
																type="image"
																className="w-full h-full object-cover"
															/>
														</div>
														<div className="min-w-0">
														<p className="text-xs font-medium">Item {idx + 1}</p>
														<p className="text-xs text-muted-foreground">{g.source === 'gdrive' ? 'Google Drive link' : 'Link/Upload lokal'}</p>
														<p className="text-xs break-all mt-1">{g.url}</p>
														</div>
													</div>
													<div className="flex items-center gap-1 shrink-0">
														<Button
															type="button"
															size="icon"
															variant="ghost"
															title="Ubah lewat link"
															onClick={() => {
																setGalleryEditIndex(idx);
																setGalleryEditUrl(g.url);
															}}>
															<Pencil className="h-4 w-4" />
														</Button>
														<Button
															type="button"
															size="icon"
															variant="ghost"
															title="Ganti via upload"
															disabled={uploadingGallery}
															onClick={() => {
																setGalleryUploadTargetIndex(idx);
																galleryFileRef.current?.click();
															}}>
															<Upload className="h-4 w-4" />
														</Button>
														<Button
															type="button"
															size="icon"
															variant="ghost"
															className="text-destructive"
															title="Hapus item"
															onClick={() =>
																{
																	const oldUrl = String(form.gallery[idx]?.url || '');
																	setForm((f) => ({
																		...f,
																		gallery: f.gallery.filter((_, i) => i !== idx),
																	}));
																	if (oldUrl && sessionUploadedUrls.includes(oldUrl)) {
																		cleanupStoreUploads([oldUrl]);
																		setSessionUploadedUrls((prev) => prev.filter((u) => u !== oldUrl));
																	}
																}
															}>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>
												{galleryEditIndex === idx && (
													<div className="mt-2 flex flex-col sm:flex-row gap-2">
														<Input
															value={galleryEditUrl}
															onChange={(e) => setGalleryEditUrl(e.target.value)}
															placeholder="Masukkan URL baru"
														/>
														<Button
															type="button"
															size="sm"
															disabled={!galleryEditUrl.trim()}
															onClick={() => {
																const oldUrl = String(form.gallery[idx]?.url || '');
																setForm((f) => {
																	const next = [...f.gallery];
																	next[idx] = toGalleryItem(galleryEditUrl);
																	return { ...f, gallery: next };
																});
																if (oldUrl && sessionUploadedUrls.includes(oldUrl)) {
																	cleanupStoreUploads([oldUrl]);
																	setSessionUploadedUrls((prev) => prev.filter((u) => u !== oldUrl));
																}
																setGalleryEditIndex(null);
																setGalleryEditUrl('');
															}}>
															Simpan
														</Button>
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() => {
																setGalleryEditIndex(null);
																setGalleryEditUrl('');
															}}>
															Batal
														</Button>
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						</div>
						<div className="space-y-2">
							<Label>Video demo (YouTube / Google Drive / link video publik .mp4/.webm/.mov)</Label>
							<Input
								value={form.videoUrl}
								onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
								placeholder="https://youtu.be/xxxxx atau https://drive.google.com/file/d/xxxxx/view atau https://cdn.contoh.com/demo.mp4"
							/>
						</div>
						<div className="grid sm:grid-cols-3 gap-4">
							<div className="space-y-2">
								<Label>Override WA (opsional)</Label>
								<Input
									value={form.whatsappPhoneOverride}
									onChange={(e) =>
										setForm((f) => ({ ...f, whatsappPhoneOverride: e.target.value }))
									}
									placeholder="6281234567890 — kosongkan untuk pakai nomor di pengaturan toko"
								/>
							</div>
							<div className="space-y-2">
								<Label>Override nama kontak (opsional)</Label>
								<Input
									value={form.whatsappContactNameOverride}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											whatsappContactNameOverride: e.target.value,
										}))
									}
									placeholder="Contoh: Admin Encoder Store"
								/>
							</div>
							<div className="space-y-2">
								<Label>Override alamat toko (opsional)</Label>
								<Input
									value={form.storeAddressOverride}
									onChange={(e) =>
										setForm((f) => ({ ...f, storeAddressOverride: e.target.value }))
									}
									placeholder="Jl. Contoh No. 1, Bandung — untuk pesan ambil di tempat produk ini"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Override template pesan beli (opsional)</Label>
							<Textarea
								rows={3}
								value={form.buyMessageTemplateOverride}
								onChange={(e) =>
									setForm((f) => ({ ...f, buyMessageTemplateOverride: e.target.value }))
								}
								placeholder={
									'Halo, saya mau pesan {{productName}} seharga {{price}} sebanyak {{qty}}. Link: {{url}}'
								}
							/>
						</div>
						<div className="flex items-center justify-between gap-4 rounded-lg border p-4 bg-muted/40">
							<div className="space-y-1">
								<p className="text-sm font-medium">Status publikasi</p>
								<p className="text-xs text-muted-foreground">
									{form.published
										? 'Produk terbit dan terlihat di halaman toko publik.'
										: 'Draft — hanya tampil di dashboard, belum di halaman toko.'}
								</p>
							</div>
							<div className="flex items-center gap-3 shrink-0">
								<Switch
									id="toko-product-published"
									checked={form.published}
									onCheckedChange={(v) => setForm((f) => ({ ...f, published: !!v }))}
								/>
								<Label htmlFor="toko-product-published" className="cursor-pointer">
									{form.published ? 'Terbit' : 'Draft'}
								</Label>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => void closeProductDialog()}>
							Batal
						</Button>
						<Button onClick={() => saveProductMutation.mutate()} disabled={saveProductMutation.isPending}>
							{saveProductMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								'Simpan'
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Kategori baru</DialogTitle>
					</DialogHeader>
					<div className="space-y-2 py-2">
						<Label>Nama kategori</Label>
						<Input
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							placeholder="Contoh: Aksesoris"
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									if (newCategoryName.trim()) createCategoryMutation.mutate();
								}
							}}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setNewCategoryOpen(false)}>
							Batal
						</Button>
						<Button
							onClick={() => createCategoryMutation.mutate()}
							disabled={!newCategoryName.trim() || createCategoryMutation.isPending}>
							{createCategoryMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								'Simpan'
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!shareProductId} onOpenChange={(o) => !o && setShareProductId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Bagikan akses produk</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="flex gap-2">
							<Input
								placeholder="username user"
								value={shareUsername}
								onChange={(e) => setShareUsername(e.target.value)}
							/>
							<select
								className="border rounded-md px-2 text-sm"
								value={shareLevel}
								onChange={(e) => setShareLevel(e.target.value as 'view' | 'edit')}>
								<option value="view">Lihat saja</option>
								<option value="edit">Edit</option>
							</select>
							<Button type="button" onClick={() => addShareMutation.mutate()} disabled={!shareUsername.trim()}>
								Tambah
							</Button>
						</div>
						<ul className="text-sm space-y-2">
							{shares.map((s: any) => (
								<li key={s._id} className="flex justify-between items-center border rounded px-2 py-1">
									<span>
										{(s.targetUserId as any)?.username} — {s.accessLevel}
									</span>
									<Button
										size="sm"
										variant="ghost"
										className="text-destructive"
										onClick={() => deleteShareMutation.mutate(s._id)}>
										Hapus
									</Button>
								</li>
							))}
						</ul>
					</div>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
