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
  const { data: settings } = useQuery<Settings>({ 
    queryKey: ['/api/settings'],
  });

  return (
    <section id="about" className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-primary mb-2">Tentang Kami</h2>
          <div className="w-24 h-1 bg-primary mx-auto"></div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {settings?.aboutUs ? (
            <div className="prose prose-lg mx-auto">
              <div dangerouslySetInnerHTML={{ __html: settings.aboutUs }} />
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <p className="mb-4">Informasi tentang himpunan belum tersedia.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}