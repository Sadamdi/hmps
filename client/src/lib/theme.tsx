import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
	theme: Theme;
	toggleTheme: () => void;
	isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
	theme: 'dark',
	toggleTheme: () => {},
	isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<Theme>(() => {
		try {
			const stored = localStorage.getItem('hmps-theme') as Theme | null;
			return stored === 'light' || stored === 'dark' ? stored : 'dark';
		} catch {
			return 'dark';
		}
	});

	useEffect(() => {
		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
		try {
			localStorage.setItem('hmps-theme', theme);
		} catch {}
	}, [theme]);

	const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
			{children}
		</ThemeContext.Provider>
	);
}

export const useTheme = () => useContext(ThemeContext);
