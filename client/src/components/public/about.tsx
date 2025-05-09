import { useQuery } from "@tanstack/react-query";

interface Settings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  aboutUs: string;
  visionMission: string;
  contactEmail: string;
  address: string;
  enableRegistration: boolean;
  maintenanceMode: boolean;
  footerText: string;
  socialLinks: {
    facebook: string;
    twitter: string;
    instagram: string;
    youtube: string;
  };
}

export default function About() {
  // Fetch settings for about us content
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
    staleTime: 1000, // Consider data fresh for only 1 second
    refetchOnWindowFocus: true,
  });
  
  return (
    <section id="about" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">Tentang Kami</h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-50 p-6 rounded-lg shadow-md">
            <div className="text-primary text-4xl mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Komunitas</h3>
            <p className="text-gray-600">
              Membangun komunitas mahasiswa informatika yang solid melalui berbagai kegiatan bersama.
            </p>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg shadow-md">
            <div className="text-primary text-4xl mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Pengembangan</h3>
            <p className="text-gray-600">
              Mengembangkan potensi akademik dan non-akademik mahasiswa melalui pelatihan dan kompetisi.
            </p>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg shadow-md">
            <div className="text-primary text-4xl mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Inovasi</h3>
            <p className="text-gray-600">
              Mendorong inovasi dan kreativitas dalam bidang teknologi informasi untuk memecahkan masalah nyata.
            </p>
          </div>
        </div>
        
        {/* About Us Content from Database */}
        <div className="mt-12 prose prose-lg max-w-none">
          {settings?.aboutUs ? (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100" dangerouslySetInnerHTML={{ __html: settings.aboutUs }} />
          ) : (
            <div className="text-center">
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                Himpunan Mahasiswa Teknik Informatika UIN Malang berkomitmen untuk menciptakan lingkungan yang mendukung 
                pengembangan akademis dan profesional bagi seluruh anggotanya, sambil membangun jejaring yang kuat 
                dengan industri dan masyarakat.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
