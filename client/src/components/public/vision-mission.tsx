import { useRevealAnimation } from "@/hooks/use-reveal-animation";
import { PublicSectionHeader } from "@/components/public/section-header";
import { HIMATIF_MISSION, HIMATIF_VISION } from "@shared/himatif-defaults";
import { useQuery } from "@tanstack/react-query";
import { Check, Target } from "lucide-react";
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
    visi: HIMATIF_VISION,
    misi: HIMATIF_MISSION,
  };

  const hasVision = Boolean(settings?.visionMission?.trim());
  const showHimatifDefault = !hasVision;

  return (
    <section
      id="vision-mission"
      className="relative py-16 text-foreground"
      style={{ background: 'var(--gradient-vision-section)' }}>
      {/* Top connector gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      <div className="container mx-auto px-4">
        <PublicSectionHeader
          headingRef={headingRef}
          visible={headingVisible}
          eyebrow="Kelembagaan"
          icon={<Target />}
          title="Visi & Misi"
          description="Landasan gerak dan arah perjuangan organisasi"
        />

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
              {hasVision
                ? settings!.visionMission
                    .split("- MISI")[0]
                    .replace("- VISI", "")
                    .trim()
                : showHimatifDefault
                  ? defaultVisionMission.visi
                  : "Visi & misi belum diisi. Lengkapi di Dashboard → Kelembagaan."}
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
              {hasVision
                ? // If we have settings, extract misi points from the settings string
                  settings!.visionMission
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
                : showHimatifDefault
                  ? defaultVisionMission.misi.map((item, index) => (
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
                  ))
                  : null}
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
