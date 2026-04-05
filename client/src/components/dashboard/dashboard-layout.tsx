import AIChat from '@/components/public/ai-chat';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/lib/tenant-context';
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import Header from './header';
import Sidebar from './sidebar';

/** Path penuh untuk chat AI: di komunitas gabungkan basePath + path relatif nested router. */
function useResolvedDashboardPath(locationPath: string): string {
	const { isTenant, basePath } = useTenant();
	return useMemo(() => {
		if (!isTenant || !basePath) return locationPath;
		const loc = locationPath.startsWith('/')
			? locationPath
			: `/${locationPath}`;
		if (loc === basePath || loc.startsWith(`${basePath}/`)) return loc;
		return `${basePath}${loc}`;
	}, [isTenant, basePath, locationPath]);
}

interface DashboardLayoutProps {
	title: string;
	children: React.ReactNode;
	/** Gabung ke pageContext.pageData (mis. settingsTab untuk Settings). */
	pageContextExtra?: { pageData?: Record<string, unknown> };
}

export default function DashboardLayout({
	title,
	children,
	pageContextExtra,
}: DashboardLayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [sidebarExpanded, setSidebarExpanded] = useState(true);
	const { permissions } = useAuth();
	const [locationPath] = useLocation();
	const { isTenant, slug, basePath } = useTenant();
	const fullPath = useResolvedDashboardPath(locationPath);

	return (
		<div
			className="min-h-screen text-foreground transition-colors duration-150 ease-out"
			style={{ background: 'var(--gradient-dashboard)' }}>
			<Sidebar
				mobileOpen={mobileMenuOpen}
				onMobileToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
				expanded={sidebarExpanded}
				onExpandedChange={setSidebarExpanded}
			/>
			<div
				className={`flex flex-col ml-0 transition-all duration-300 ease-out ${
					sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'
				}`}>
				<Header
					title={title}
					onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
				/>
				<main className="relative min-w-0 flex-1 p-3 transition-colors duration-150 ease-out sm:p-4 lg:p-6">
					<div className="mx-auto max-w-7xl min-w-0">{children}</div>
					{/* AI Chat untuk semua halaman dashboard, dengan context path + permissions */}
					<AIChat
						pageContext={{
							path: fullPath,
							permissions,
							isTenant,
							tenantSlug: isTenant ? slug : undefined,
							basePath: isTenant ? basePath : undefined,
							...(pageContextExtra?.pageData
								? { pageData: pageContextExtra.pageData }
								: {}),
						}}
					/>
				</main>
			</div>
		</div>
	);
}
