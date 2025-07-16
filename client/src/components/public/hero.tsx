import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
  const [showText, setShowText] = useState(false);
  const [textMoveUp, setTextMoveUp] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showPerson, setShowPerson] = useState(false);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // 1. Show text first di tengah
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 300);

    // 2. Move text up setelah muncul
    const moveUpTimer = setTimeout(() => {
      setTextMoveUp(true);
    }, 1200);

    // 3. Show banner setelah text naik
    const bannerTimer = setTimeout(() => {
      setShowBanner(true);
    }, 2000);

    // 4. Show person setelah banner
    const personTimer = setTimeout(() => {
      setShowPerson(true);
    }, 2500);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(moveUpTimer);
      clearTimeout(bannerTimer);
      clearTimeout(personTimer);
    };
  }, []);

  const getParallaxStyle = (ratio: number) => ({
    transform: `translate3d(0, ${scrollY * ratio}px, 0)`,
    willChange: "transform",
  });

  // Scroll limit where we start hiding banner - lebih besar agar teks bertahan lebih lama
  const fadeOutThreshold = 800;
  const textFadeOutThreshold = 1000; // Teks hilang lebih lambat dari gambar
  const opacityValue = Math.max(0, 1 - scrollY / fadeOutThreshold);
  const textOpacityValue = Math.max(0, 1 - scrollY / textFadeOutThreshold);

  return (
    <div id="home" className="relative w-full h-[200vh] overflow-hidden">
      {/* Fixed Banner inside Hero */}
      <div
        className={`fixed top-0 left-0 w-full h-[400px] z-0 pointer-events-none transition-all duration-1000 ease-out ${
          showBanner ? "opacity-100" : "opacity-0"
        }`}
        style={{ opacity: showBanner ? opacityValue : 0 }}
      >
        <img
          src="/attached_assets/bennerfull.png"
          alt="Banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-white via-white/70 to-transparent" />
      </div>

      {/* Teks tengah */}
      <div
        className={`absolute left-1/2 z-[5] text-center bg-white/80 backdrop-blur-sm px-6 py-8 rounded-lg shadow-lg transition-all duration-1000 ease-out ${
          showText ? "opacity-100" : "opacity-0"
        }`}
        style={{
          ...getParallaxStyle(-0.6),
          transform: `translate3d(-50%, ${
            textMoveUp ? -100 + scrollY * -0.6 : -50 + scrollY * -0.6
          }%, 0)`,
          left: "50%",
          top: textMoveUp ? "35%" : "50%",
          opacity: showText ? textOpacityValue : 0,
          transition: "all 1s ease-out",
        }}
      >
        <h1 className="text-5xl font-bold mb-3 text-gray-800">
          {settings?.siteName}
        </h1>
        <h2 className="text-3xl mb-2 text-gray-700">{settings?.siteTagline}</h2>
        <p className="text-lg text-gray-600">{settings?.siteDescription}</p>
      </div>

      {/* Gambar orang */}
      <div
        className={`fixed top-0 left-0 w-full h-full z-10 pointer-events-none transition-all duration-1000 ease-out ${
          showPerson ? "opacity-100" : "opacity-0"
        }`}
        style={{
          ...getParallaxStyle(0.4),
          opacity: showPerson ? opacityValue : 0,
        }}
      >
        <img
          src="/attached_assets/orang.png"
          alt="Orang"
          className={`w-full h-full object-contain transition-all duration-1000 ease-out ${
            showPerson ? "scale-100" : "scale-95"
          }`}
        />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[linear-gradient(to_top,_rgba(255,255,255,1)_0%,_rgba(255,255,255,1)_30%,_rgba(255,255,255,0)_100%)]" />
      </div>
    </div>
  );
}
