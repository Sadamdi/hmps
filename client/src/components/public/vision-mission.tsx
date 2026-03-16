import { useRevealAnimation } from "@/hooks/use-reveal-animation";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Link } from "wouter";

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

interface VisionMissionProps {
  showLink?: boolean;
}

export default function VisionMission({ showLink = true }: VisionMissionProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();

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
    <section
      id="vision-mission"
      className="relative py-16 text-foreground"
      style={{ background: 'var(--gradient-vision-section)' }}>
      {/* Top connector gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      <div className="container mx-auto px-4">
        <div ref={headingRef} className="text-center mb-12">
          <p className={`text-sm font-semibold tracking-widest text-cyan-400/80 uppercase mb-3 ${headingVisible ? 'reveal-heading' : 'opacity-0'}`}>
            {currentYear}
          </p>
          <h1 className={`text-4xl font-bold mb-3 text-foreground ${headingVisible ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'}`}>
            {siteName}
          </h1>
          <div className={`mx-auto w-24 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent my-6 ${headingVisible ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'}`} />
          <h2 className={`text-3xl font-bold tracking-tight text-foreground ${headingVisible ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'}`}>VISI &amp; MISI</h2>
          <p className={`mt-3 text-muted-foreground text-sm max-w-md mx-auto ${headingVisible ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'}`}>
            Landasan gerak dan arah perjuangan organisasi
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Visi Section */}
          <div className="mb-14" data-aos="fade-up" data-aos-delay="200">
            {/* Section label pill */}
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-sm font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Visi
              </span>
            </div>
            <p className="text-lg text-center leading-relaxed text-foreground/90">
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
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-300 text-sm font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                Misi
              </span>
            </div>

            <div className="space-y-4">
              {settings?.visionMission
                ? // If we have settings, extract misi points from the settings string
                  settings.visionMission
                    .split("- MISI")[1]
                    ?.split("*")
                    .filter((item) => item.trim().length > 0)
                    .map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 p-4 bg-card/40 border border-cyan-500/20 rounded-xl hover:border-teal-400/30 transition-colors"
                        data-aos="fade-left"
                        data-aos-delay={600 + index * 80}
                      >
                        <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center">
                          <Check className="h-4 w-4 text-teal-400" />
                        </div>
                        <p className="text-base text-foreground/90 leading-relaxed">{item.trim()}</p>
                      </div>
                    ))
                : // Default misi points
                  defaultVisionMission.misi.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 bg-card/40 border border-cyan-500/20 rounded-xl hover:border-teal-400/30 transition-colors"
                      data-aos="fade-left"
                      data-aos-delay={600 + index * 80}
                    >
                      <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center">
                        <Check className="h-4 w-4 text-teal-400" />
                      </div>
                      <p className="text-base text-foreground/90 leading-relaxed">{item}</p>
                    </div>
                  ))}
            </div>
          </div>
          {showLink && (
            <div className="flex justify-center mt-10">
              <Link href="/kelembagaan">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/70 transition-all duration-200">
                  Lihat kelembagaan lengkap
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
      {/* Bottom connector gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
    </section>
  );
}
