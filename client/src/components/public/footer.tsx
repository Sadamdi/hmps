import { useQuery } from '@tanstack/react-query';

interface Settings {
	contactEmail?: string;
	address?: string;
	footerText?: string;
	socialLinks?: {
		facebook: string;
		tiktok: string;
		instagram: string;
		youtube: string;
	};
	links?: {
		uinMalang: string;
		fakultasSainsTeknologi: string;
		jurusanTeknikInformatika: string;
		perpustakaan: string;
	};
}

export default function Footer() {
	// Fetch settings to get footerText and socialLinks
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		staleTime: 1000, // Consider data fresh for only 1 second
		refetchOnWindowFocus: true,
	});

	// Get contact info from settings
	const contactEmail = settings?.contactEmail || 'hmti@uin-malang.ac.id';
	const address =
		settings?.address ||
		'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang';
	const footerText =
		settings?.footerText ||
		`© ${new Date().getFullYear()} Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.`;
	const socialLinks = settings?.socialLinks || {
		facebook: '#',
		tiktok: '#',
		instagram: '#',
		youtube: '#',
	};
	const links = settings?.links || {
		uinMalang: 'https://uin-malang.ac.id/',
		fakultasSainsTeknologi: 'https://saintek.uin-malang.ac.id/',
		jurusanTeknikInformatika: 'https://informatika.uin-malang.ac.id/',
		perpustakaan: 'https://library.uin-malang.ac.id/',
	};

	return (
		<footer className="bg-gray-800 text-white py-12">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid md:grid-cols-4 sm:grid-cols-2 gap-8">
					<div
						data-aos="fade-up"
						data-aos-delay="100">
						<h3 className="text-lg font-semibold mb-4">Tentang HMTI</h3>
						<p className="text-gray-400">
							Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim
							Malang
						</p>
						<p className="mt-4 text-gray-400">Salam Satu Saudara Informatika</p>
					</div>

					<div
						data-aos="fade-up"
						data-aos-delay="200">
						<h3 className="text-lg font-semibold mb-4">Kontak</h3>
						<ul className="space-y-2 text-gray-400">
							<li className="flex items-start">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 mr-2 text-gray-300"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
									/>
								</svg>
								{contactEmail}
							</li>
							<li className="flex items-start">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 mr-2 text-gray-300"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								{address}
							</li>
						</ul>
					</div>

					<div
						data-aos="fade-up"
						data-aos-delay="300">
						<h3 className="text-lg font-semibold mb-4">Tautan</h3>
						<ul className="space-y-2 text-gray-400">
							<li>
								<a
									href={links.uinMalang}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-white transition">
									UIN Malang
								</a>
							</li>
							<li>
								<a
									href={links.fakultasSainsTeknologi}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-white transition">
									Fakultas Sains dan Teknologi
								</a>
							</li>
							<li>
								<a
									href={links.jurusanTeknikInformatika}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-white transition">
									Jurusan Teknik Informatika
								</a>
							</li>
							<li>
								<a
									href={links.perpustakaan}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-white transition">
									Perpustakaan
								</a>
							</li>
						</ul>
					</div>

					<div
						data-aos="fade-up"
						data-aos-delay="400">
						<h3 className="text-lg font-semibold mb-4">Media Sosial</h3>
						<div className="flex space-x-4">
							<a
								href={socialLinks.instagram}
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6"
									fill="currentColor"
									viewBox="0 0 24 24">
									<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
								</svg>
							</a>
							<a
								href={socialLinks.tiktok}
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6"
									fill="currentColor"
									viewBox="0 0 24 24">
									<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
								</svg>
							</a>
							<a
								href={socialLinks.youtube}
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6"
									fill="currentColor"
									viewBox="0 0 24 24">
									<path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
								</svg>
							</a>
							<a
								href={socialLinks.facebook}
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6"
									fill="currentColor"
									viewBox="0 0 24 24">
									<path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
								</svg>
							</a>
						</div>
					</div>
				</div>

				<div
					className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-400 text-sm"
					data-aos="fade-up"
					data-aos-delay="500">
					<p>{footerText}</p>
				</div>
			</div>
		</footer>
	);
}
