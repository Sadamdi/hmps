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

export default function VisionMission() {
  // Fetch settings for Vision Mission content
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
    staleTime: 1000, // Consider data fresh for only 1 second
    refetchOnWindowFocus: true,
  });
  
  return (
    <section id="vision-mission" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">Visi & Misi</h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
        </div>
        
        {settings?.visionMission ? (
          <div className="bg-white rounded-lg p-8 shadow-md prose prose-blue prose-lg max-w-none" 
            dangerouslySetInnerHTML={{ __html: settings.visionMission }} />
        ) : (
          <div className="bg-white rounded-lg p-8 shadow-md">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Visi HMTI UIN Malang</h3>
            <p className="text-gray-700 mb-6">
              Menjadi himpunan mahasiswa yang unggul, profesional, dan berkontribusi dalam pengembangan 
              ilmu pengetahuan dan teknologi informatika yang berbasis pada nilai-nilai Islam.
            </p>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Misi HMTI UIN Malang</h3>
            <ol className="list-decimal pl-5 text-gray-700 space-y-2">
              <li>Meningkatkan kualitas akademik dan profesionalisme anggota dalam bidang teknologi informatika</li>
              <li>Mengembangkan iklim penelitian dan inovasi di bidang informatika</li>
              <li>Membangun kerjasama dengan berbagai pihak untuk meningkatkan kompetensi anggota</li>
              <li>Menyelenggarakan kegiatan yang bermanfaat bagi pengembangan anggota dan masyarakat</li>
              <li>Menanamkan nilai-nilai Islam dalam setiap kegiatan himpunan</li>
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}