import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

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

interface Member {
  _id: string;
  name: string;
  position: string;
  period: string;
  imageUrl: string;
}

export default function Hero({ scrollToSection }: HeroProps) {
  // Fetch settings for site name and tagline
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });
  
  // Fetch organization members to display the leaders
  const { data: members } = useQuery<Member[]>({
    queryKey: ['/api/organization/members'],
    staleTime: 1000,
  });
  
  // Get site name and tagline from settings with fallbacks
  const siteName = settings?.siteName || "Himpunan Mahasiswa Teknik Informatika";
  const siteTagline = settings?.siteTagline || "Salam Satu Saudara Informatika";
  const siteDescription = settings?.siteDescription || "Himpunan Mahasiswa Teknik Informatika";
  
  // Filter members by position
  const chairperson = members?.find((m) => 
    m.position === "Ketua Umum" || m.position.toLowerCase().includes("ketua umum")
  );
  
  const viceChairperson = members?.find((m) => 
    m.position === "Wakil Ketua" || m.position.toLowerCase().includes("wakil ketua")
  );
  
  const divisionHeads = members?.filter((m) => 
    m.position.toLowerCase().includes("kepala divisi") || 
    m.position.toLowerCase().includes("ketua divisi")
  );

  return (
    <section id="home" className="relative min-h-screen overflow-hidden" 
      style={{
        background: "linear-gradient(90deg, #1a237e 0%, #283593 35%, #5e35b1 100%)",
      }}
    >
      {/* Top Navigation Bar */}
      <nav className="relative z-30 flex justify-between items-center px-8 py-4 text-white">
        <div>
          <span className="text-yellow-500 font-bold text-xl">HIMATIF ENCODER</span>
        </div>
        <div className="flex space-x-8">
          <Link href="/" className="font-medium hover:text-yellow-300">HOME</Link>
          <Link href="#profile" className="font-medium hover:text-yellow-300">PROFILE</Link>
          <Link href="#kelembagaan" className="font-medium hover:text-yellow-300">KELEMBAGAAN</Link>
          <Link href="#artikel" className="font-medium hover:text-yellow-300">ARTIKEL</Link>
          <Link href="#gallery" className="font-medium hover:text-yellow-300">GALLERY</Link>
          <Link href="#informatika" className="font-medium hover:text-yellow-300">INFORMATIKA</Link>
        </div>
      </nav>
      
      {/* Background Images (behind everything) - Colored Sections for Members */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 flex">
          {/* Create a colored grid for division heads */}
          <div className="flex w-full h-full">
            {/* Left division heads - 3 different colors */}
            <div className="w-1/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.akademik || "rgba(233, 30, 99, 0.75)" 
            }}></div>
            <div className="w-1/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.humas || "rgba(156, 39, 176, 0.75)" 
            }}></div>
            <div className="w-1/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.pengembangan || "rgba(103, 58, 183, 0.75)" 
            }}></div>
            
            {/* Center for chair/vice - 1 color */}
            <div className="w-2/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.leadership || "rgba(33, 150, 243, 0.75)" 
            }}></div>
            
            {/* Right division heads - 3 different colors */}
            <div className="w-1/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.media || "rgba(0, 188, 212, 0.75)" 
            }}></div>
            <div className="w-1/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.keuangan || "rgba(76, 175, 80, 0.75)" 
            }}></div>
            <div className="w-1/7 h-full" style={{ 
              backgroundColor: settings?.divisionColors?.acara || "rgba(255, 152, 0, 0.75)" 
            }}></div>
          </div>
        </div>
        
        {/* Overlay with watermark text */}
        <div className="absolute inset-0 z-1 flex items-center justify-center">
          <h1 className="text-white text-opacity-10 text-9xl font-bold tracking-widest transform -rotate-12">
            ENCODER 23
          </h1>
        </div>
        
        {/* Overlay with member images */}
        <div className="absolute inset-x-0 bottom-0 flex h-64 opacity-70 mix-blend-multiply">
          {/* Person images - all in one row */}
          <div className="flex w-full h-full">
            {/* Left division heads */}
            {divisionHeads?.slice(0, 3).map((head, index) => {
              // Determine which division logo to display
              let divisionLogo = null;
              if (head.position.toLowerCase().includes("akademik")) {
                divisionLogo = settings?.divisionLogos?.akademik;
              } else if (head.position.toLowerCase().includes("humas")) {
                divisionLogo = settings?.divisionLogos?.humas;
              } else if (head.position.toLowerCase().includes("pengembangan")) {
                divisionLogo = settings?.divisionLogos?.pengembangan;
              }
              
              return (
                <div key={head._id || index} className="w-1/7 h-full relative">
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${head.imageUrl || "/default-user.png"})`,
                      backgroundPosition: "center top",
                      backgroundSize: "cover"
                    }}
                  />
                </div>
              );
            })}
            
            {/* Chair and Vice Chair */}
            {chairperson && (
              <div className="w-1/7 h-full relative">
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${chairperson.imageUrl || "/default-user.png"})`,
                    backgroundPosition: "center top",
                    backgroundSize: "cover"
                  }}
                />
              </div>
            )}
            
            {viceChairperson && (
              <div className="w-1/7 h-full relative">
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${viceChairperson.imageUrl || "/default-user.png"})`,
                    backgroundPosition: "center top",
                    backgroundSize: "cover"
                  }}
                />
              </div>
            )}
            
            {/* Right division heads */}
            {divisionHeads?.slice(3, 6).map((head, index) => {
              // Determine which division logo to display
              let divisionLogo = null;
              if (head.position.toLowerCase().includes("media")) {
                divisionLogo = settings?.divisionLogos?.media;
              } else if (head.position.toLowerCase().includes("keuangan")) {
                divisionLogo = settings?.divisionLogos?.keuangan;
              } else if (head.position.toLowerCase().includes("acara")) {
                divisionLogo = settings?.divisionLogos?.acara;
              }
              
              return (
                <div key={head._id || index} className="w-1/7 h-full relative">
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${head.imageUrl || "/default-user.png"})`,
                      backgroundPosition: "center top",
                      backgroundSize: "cover"
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Background overlay pattern */}
        <div className="absolute inset-0 bg-[url('/pattern.svg')] bg-repeat opacity-10 mix-blend-overlay"></div>
      </div>
      
      {/* Logo at center top - above everything */}
      <div className="relative z-10 mx-auto pt-16 pb-4">
        <img 
          src={settings?.logoUrl || "/logo.png"} 
          alt="Logo Himpunan" 
          className="w-24 h-24 mx-auto"
        />
      </div>
      
      {/* Text content - above background with members */}
      <div className="relative z-10 container mx-auto px-8 py-10 text-white">
        <div className="max-w-3xl mt-16">
          <h1 className="text-5xl md:text-7xl font-bold mb-2">{siteTagline}</h1>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{siteName}</h2>
          <p className="text-lg mb-8">{siteDescription}</p>
          <button 
            onClick={() => scrollToSection('about')} 
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-full font-semibold text-lg transition-colors"
          >
            SELENGKAPNYA
          </button>
        </div>
      </div>
      
      {/* Wave decoration at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-auto">
          <path 
            fill="#ffffff" 
            fillOpacity="1" 
            d="M0,32L48,37.3C96,43,192,53,288,64C384,75,480,85,576,80C672,75,768,53,864,48C960,43,1056,53,1152,58.7C1248,64,1344,64,1392,64L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z">
          </path>
        </svg>
      </div>
    </section>
  );
}
