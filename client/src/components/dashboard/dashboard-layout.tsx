import { useState } from 'react';
import Header from './header';
import Sidebar from './sidebar';

interface DashboardLayoutProps {
	title: string;
	children: React.ReactNode;
}

export default function DashboardLayout({
	title,
	children,
}: DashboardLayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [sidebarExpanded, setSidebarExpanded] = useState(true);

	return (
		<div className="min-h-screen text-foreground" style={{ background: 'var(--gradient-dashboard)' }}>
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
				<main className="flex-1 p-3 sm:p-4 lg:p-6">
					<div className="max-w-7xl mx-auto">{children}</div>
				</main>
			</div>
		</div>
	);
}
