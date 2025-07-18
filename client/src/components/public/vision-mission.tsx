import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

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
  logoUrl: string;
  divisionLogos: {
    akademik: string;
    humas: string;
    pengembangan: string;
    media: string;
    keuangan: string;
    acara: string;
  };
  divisionColors: {
    akademik: string;
    humas: string;
    pengembangan: string;
    leadership: string;
    media: string;
    keuangan: string;
    acara: string;
  };
  socialLinks: {
    facebook: string;
    twitter: string;
    instagram: string;
    youtube: string;
  };
}

export default function VisionMission() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const defaultVisionMission = {
    visi: "Mewujudkan Himpunan Mahasiswa Teknik Informatika yang berintegritas, progresif, dan adaptif sebagai wadah kolaborasi yang responsif, transparan, partisipatif, menjunjung tinggi nilai kekeluargaan, menciptakan lingkungan yang harmonis, inovatif, dan berorientasi pada kemajuan berkelanjutan.",
    misi: [
      "Meningkatkan lingkungan yang kondusif untuk dialog terbuka, penguatan solidaritas, dan pengamalan kepedulian kolektif, dengan semangat kebersamaan untuk mendukung hubungan yang harmonis dan produktif antar anggota.",
      "Mengintegrasikan nilai-nilai budaya lokal, nasional, dan profesionalisme dalam setiap program kerja, menumbuhkan kesadaran akan tanggung jawab sosial, meningkatkan kompetensi akademik, soft skills, kepemimpinan, dan inovasi teknologi melalui berbagai kegiatan produktif.",
      "Mengoptimalkan peran Himpunan sebagai wadah pemberdayaan anggota dengan memberikan perhatian terhadap aspirasi, memfasilitasi pengembangan diri, dan menciptakan jaringan kolaborasi yang efektif dengan berbagai pihak untuk mendorong kontribusi aktif dalam pembangunan dan pengembangan organisasi.",
    ],
  };

  const currentYear = new Date().getFullYear();
  const siteName = settings?.siteName || "Himatif Encoder";

  return (
    <section id="vision-mission" className="py-16 bg-blue-900 text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12" data-aos="fade-up">
          <h1 className="text-4xl font-bold mb-6">
            {siteName} {currentYear}
          </h1>
          <div className="w-full h-px bg-gray-200 opacity-25 my-8"></div>
          <h2 className="text-4xl font-bold mb-12">VISI MISI</h2>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Visi Section */}
          <div className="mb-16" data-aos="fade-up" data-aos-delay="200">
            <h3 className="text-3xl font-bold mb-8 text-center">Visi</h3>
            <p className="text-lg text-center leading-relaxed">
              {settings?.visionMission
                ? settings.visionMission
                    .split("- MISI")[0]
                    .replace("- VISI", "")
                    .trim()
                : defaultVisionMission.visi}
            </p>
          </div>

          {/* Misi Section */}
          <div data-aos="fade-up" data-aos-delay="400">
            <h3 className="text-3xl font-bold mb-8 text-center">Misi</h3>

            <div className="space-y-6">
              {settings?.visionMission
                ? // If we have settings, extract misi points from the settings string
                  settings.visionMission
                    .split("- MISI")[1]
                    ?.split("*")
                    .filter((item) => item.trim().length > 0)
                    .map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start p-4 bg-white bg-opacity-10 rounded-lg"
                        data-aos="fade-left"
                        data-aos-delay={600 + index * 100}
                      >
                        <div className="mr-4 mt-1">
                          <Check className="h-6 w-6 text-white" />
                        </div>
                        <p className="text-lg">{item.trim()}</p>
                      </div>
                    ))
                : // Default misi points
                  defaultVisionMission.misi.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start p-4 bg-white bg-opacity-10 rounded-lg"
                      data-aos="fade-left"
                      data-aos-delay={600 + index * 100}
                    >
                      <div className="mr-4 mt-1">
                        <Check className="h-6 w-6 text-white" />
                      </div>
                      <p className="text-lg">{item}</p>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
