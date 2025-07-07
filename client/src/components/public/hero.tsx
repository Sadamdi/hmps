import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

interface HeroProps {
  scrollToSection: (id: string) => void;
}

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
  divisionLogos: Record<string, string>;
  divisionColors: Record<string, string>;
  socialLinks: Record<string, string>;
  divisionNames: Record<string, string>;
  chairpersonName: string;
  chairpersonPhoto: string;
  chairpersonTitle: string;
  viceChairpersonName: string;
  viceChairpersonPhoto: string;
  viceChairpersonTitle: string;
  divisionHeads: {
    [key: string]: {
      name: string;
      photo: string;
    };
  };
}

export default function Hero({ scrollToSection }: HeroProps) {
  const [scrollY, setScrollY] = useState(0);
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getParallaxStyle = (ratio: number) => ({
    transform: `translate3d(0, ${scrollY * ratio}px, 0)`,
    willChange: "transform",
  });

  return (
    <div className="relative w-full">
      {/* Hero section with parallax layers */}
      <div className="relative w-full h-[200vh] overflow-hidden">
        {/* Background Banner */}
        <section
          className="fixed w-full h-[400px] top-0 left-0 z-0"
          style={getParallaxStyle(0.6)} // lebih cepat
        >
          <img
            src="/attached_assets/bennerfull.png"
            alt="Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-white via-white/70 to-transparent" />
        </section>

        {/* Teks tengah */}
        <div
          className="absolute bottom-0 left-1/2 z-[5] text-center bg-white/80 backdrop-blur-sm px-4 py-6 rounded-md shadow-md"
          style={{
            ...getParallaxStyle(-0.6), // lebih cepat
            transform: `translate3d(-50%, ${scrollY * -0.6}px, 0)`,
            left: "50%",
          }}
        >
          <h1 className="text-4xl font-bold mb-2">{settings?.siteName}</h1>
          <h2 className="text-2xl mb-1">{settings?.siteTagline}</h2>
          <p className="text-base">{settings?.siteDescription}</p>
        </div>

        {/* Gambar orang */}
        <div
          className="fixed top-0 left-0 w-full h-full z-10 pointer-events-none"
          style={getParallaxStyle(0.4)} // lebih cepat
        >
          <img
            src="/attached_assets/orang.png"
            alt="Orang"
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[linear-gradient(to_top,_rgba(255,255,255,1)_0%,_rgba(255,255,255,1)_30%,_rgba(255,255,255,0)_100%)]" />
        </div>
      </div>
      <div className="relative z-0 h-[100vh] w-full bg-white" />
    </div>
  );
}
