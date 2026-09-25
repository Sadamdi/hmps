import { Redirect, useSearch } from 'wouter';

/** `/media/youtube|instagram` (≤4.26) → `/youtube|instagram`, query (?kind=) dipertahankan. */
export function LegacyMediaRedirect({ to }: { to: '/youtube' | '/instagram' }) {
	const search = useSearch();
	return <Redirect to={search ? `${to}?${search}` : to} replace />;
}
