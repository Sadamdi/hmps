import { useQuery } from "@tanstack/react-query";

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
  const siteDescription = settings?.siteDescription || "HMPS Teknik Informatika \"Encoder\" 2023";
  
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
    <section id="home" className="relative min-h-screen pt-16 pb-0 overflow-hidden flex flex-col justify-end" 
      style={{
        background: "linear-gradient(90deg, #1a237e 0%, #283593 35%, #5e35b1 100%)",
        backgroundImage: "url('/pattern.svg'), linear-gradient(90deg, #1a237e 0%, #283593 35%, #5e35b1 100%)",
        backgroundBlendMode: "overlay",
        backgroundSize: "auto, cover",
      }}
    >
      {/* Top navbar placeholder - will be actual navbar but shown here for reference */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="flex justify-center space-x-6 text-white font-medium">
          <span className="px-4 py-2">HOME</span>
          <span className="px-4 py-2">PROFILE</span>
          <span className="px-4 py-2">KELEMBAGAAN</span>
          <span className="px-4 py-2">ARTIKEL</span>
          <span className="px-4 py-2">GALLERY</span>
          <span className="px-4 py-2">INFORMATIKA</span>
        </div>
      </div>
      
      {/* Organization Name Header - Top Left */}
      <div className="absolute top-6 left-6 z-20">
        <h3 className="text-yellow-500 font-bold text-xl md:text-2xl">HIMATIF ENCODER</h3>
      </div>
      
      {/* Logo at center top */}
      <div className="relative z-10 mx-auto mt-16 mb-6">
        <img 
          src="/logo.png" 
          alt="Logo Himpunan" 
          className="w-28 h-28 md:w-32 md:h-32 mx-auto"
        />
      </div>
      
      {/* Text content */}
      <div className="relative z-10 container mx-auto px-6 text-white mt-4">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-2">{siteTagline}</h1>
          <h2 className="text-2xl md:text-4xl font-bold mb-4">{siteName}</h2>
          <p className="text-lg mb-6">{siteDescription}</p>
          <button 
            onClick={() => scrollToSection('about')} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-semibold text-lg transition-colors"
          >
            SELENGKAPNYA
          </button>
        </div>
      </div>
      
      {/* People display */}
      <div className="relative mt-8 z-10 overflow-hidden w-full">
        <div className="flex flex-row justify-center items-end">
          {/* Division Heads (Left) */}
          <div className="flex flex-wrap justify-end w-1/3">
            {divisionHeads?.slice(0, 3).map((head: any, index: number) => (
              <div 
                key={head._id || index} 
                className="w-1/3 h-32 md:h-40 lg:h-48 xl:h-60"
                style={{
                  background: `url(${head.imageUrl || "/default-user.png"}) center top / cover no-repeat`
                }}
              />
            ))}
          </div>
          
          {/* Chair and Vice Chair (Center) */}
          <div className="flex justify-center w-1/3">
            {chairperson && (
              <div 
                className="w-1/2 h-36 md:h-44 lg:h-56 xl:h-72"
                style={{
                  background: `url(${chairperson.imageUrl || "/default-user.png"}) center top / cover no-repeat`
                }}
              />
            )}
            
            {viceChairperson && (
              <div 
                className="w-1/2 h-36 md:h-44 lg:h-56 xl:h-72"
                style={{
                  background: `url(${viceChairperson.imageUrl || "/default-user.png"}) center top / cover no-repeat`
                }}
              />
            )}
          </div>
          
          {/* Division Heads (Right) */}
          <div className="flex flex-wrap w-1/3">
            {divisionHeads?.slice(3, 6).map((head: any, index: number) => (
              <div 
                key={head._id || index} 
                className="w-1/3 h-32 md:h-40 lg:h-48 xl:h-60"
                style={{
                  background: `url(${head.imageUrl || "/default-user.png"}) center top / cover no-repeat`
                }}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Wave decoration at bottom */}
      <div className="w-full">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-auto">
          <path 
            fill="#ffffff" 
            fillOpacity="1" 
            d="M0,96L80,85.3C160,75,320,53,480,53.3C640,53,800,75,960,80C1120,85,1280,75,1360,69.3L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z">
          </path>
        </svg>
      </div>
    </section>
  );
}
