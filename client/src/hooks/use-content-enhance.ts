import { useApiUrl } from '@/lib/tenant-context';
import type {
	ContentEnhanceEntityType,
	EnhanceContentResponse,
	EnhanceFieldChange,
} from '@shared/content-enhance';
import { useCallback, useState } from 'react';

export function useContentEnhance() {
	const enhanceUrl = useApiUrl('/ai/enhance-content');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [changes, setChanges] = useState<EnhanceFieldChange[] | null>(null);
	const [meta, setMeta] = useState<{ model: string; provider: string } | null>(
		null,
	);

	const requestEnhance = useCallback(
		async (opts: {
			entityType: ContentEnhanceEntityType;
			fields: Record<string, string>;
			fieldLabels?: Record<string, string>;
			preserveHtml?: boolean;
		}) => {
			setLoading(true);
			setError(null);
			setChanges(null);
			setMeta(null);
			try {
				const res = await fetch(enhanceUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						entityType: opts.entityType,
						fields: opts.fields,
						fieldLabels: opts.fieldLabels,
						options: { preserveHtml: opts.preserveHtml ?? true },
					}),
				});
				const data = (await res.json()) as EnhanceContentResponse;
				if (!res.ok || !data.success || !data.data?.changes?.length) {
					throw new Error(data.message || 'Enhance gagal');
				}
				setChanges(data.data.changes);
				setMeta({ model: data.data.model, provider: data.data.provider });
				return data.data.changes;
			} catch (e) {
				const msg = (e as Error).message || 'Enhance gagal';
				setError(msg);
				throw e;
			} finally {
				setLoading(false);
			}
		},
		[enhanceUrl],
	);

	const reset = useCallback(() => {
		setChanges(null);
		setError(null);
		setMeta(null);
	}, []);

	return {
		loading,
		error,
		changes,
		meta,
		requestEnhance,
		reset,
	};
}
