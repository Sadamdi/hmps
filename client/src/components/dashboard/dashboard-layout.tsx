import AIChat from '@/components/public/ai-chat';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/lib/tenant-context';
import { useEffect, useMemo, useState } from 'react';
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

	useEffect(() => {
		setMobileMenuOpen(false);
	}, [locationPath]);

	return (
		<div
			className="min-h-dvh overflow-x-hidden text-foreground transition-colors duration-150 ease-out"
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
				<main
					id="dashboard-main"
					tabIndex={-1}
					className="relative min-w-0 flex-1 px-3 py-4 transition-colors duration-150 ease-out focus:outline-none sm:px-5 sm:py-6 lg:px-8 lg:py-8">
					<div className="mx-auto min-w-0 max-w-[1600px] [&_h1]:tracking-tight [&_form]:min-w-0 [&_[role=dialog]]:min-w-0 [&_.overflow-x-auto]:rounded-lg [&_.overflow-x-auto]:border [&_.overflow-x-auto]:border-border/60">
						{children}
					</div>
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
