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
    <section id="home" className="relative min-h-screen overflow-hidden" 
      style={{
        background: "linear-gradient(90deg, #1a237e 0%, #283593 35%, #5e35b1 100%)",
      }}
    >
      {/* Organization Name Header - Top Left */}
      <div className="absolute top-6 left-6 z-20">
        <h3 className="text-yellow-500 font-bold text-xl md:text-2xl">HIMATIF ENCODER</h3>
      </div>
      
      {/* Background Images (behind everything) - Colored Sections for Members */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 flex items-end">
          {/* Create a colored grid for division heads */}
          <div className="flex w-full h-[40%] items-end">
            {/* Left division heads */}
            <div className="w-1/5 h-full" style={{ backgroundColor: "rgba(233, 30, 99, 0.5)" }}></div>
            <div className="w-1/5 h-full" style={{ backgroundColor: "rgba(156, 39, 176, 0.5)" }}></div>
            <div className="w-1/5 h-full" style={{ backgroundColor: "rgba(63, 81, 181, 0.5)" }}></div>
            
            {/* Center for chair/vice */}
            <div className="w-1/5 h-full" style={{ backgroundColor: "rgba(33, 150, 243, 0.5)" }}></div>
            <div className="w-1/5 h-full" style={{ backgroundColor: "rgba(0, 188, 212, 0.5)" }}></div>
          </div>
        </div>
        
        {/* Overlay with member images */}
        <div className="absolute inset-0 flex items-end opacity-60 mix-blend-overlay">
          {/* Person images - all in one row */}
          <div className="flex w-full items-end">
            {/* Left division heads */}
            {divisionHeads?.slice(0, 3).map((head, index) => (
              <div 
                key={head._id || index} 
                className="w-1/6 h-64"
                style={{
                  backgroundImage: `url(${head.imageUrl || "/default-user.png"})`,
                  backgroundPosition: "center top",
                  backgroundSize: "cover"
                }}
              />
            ))}
            
            {/* Chair and Vice Chair */}
            {chairperson && (
              <div 
                className="w-1/6 h-64"
                style={{
                  backgroundImage: `url(${chairperson.imageUrl || "/default-user.png"})`,
                  backgroundPosition: "center top",
                  backgroundSize: "cover"
                }}
              />
            )}
            
            {viceChairperson && (
              <div 
                className="w-1/6 h-64"
                style={{
                  backgroundImage: `url(${viceChairperson.imageUrl || "/default-user.png"})`,
                  backgroundPosition: "center top",
                  backgroundSize: "cover"
                }}
              />
            )}
            
            {/* Right division heads */}
            {divisionHeads?.slice(3, 6).map((head, index) => (
              <div 
                key={head._id || index} 
                className="w-1/6 h-64"
                style={{
                  backgroundImage: `url(${head.imageUrl || "/default-user.png"})`,
                  backgroundPosition: "center top",
                  backgroundSize: "cover"
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Background overlay pattern */}
        <div className="absolute inset-0 bg-[url('/pattern.svg')] bg-repeat opacity-10 mix-blend-overlay"></div>
        
        {/* ENCODER 23 text overlay - large text in background */}
        <div className="absolute right-0 top-1/4 opacity-10 z-0 text-white">
          <div className="text-[180px] font-black tracking-widest transform -rotate-12 mr-[-100px] uppercase">Encoder '23</div>
        </div>
      </div>
      
      {/* Logo at center top - above everything */}
      <div className="relative z-10 mx-auto pt-20 pb-4">
        <img 
          src="/logo.png" 
          alt="Logo Himpunan" 
          className="w-32 h-32 mx-auto"
        />
      </div>
      
      {/* Text content - above background with members */}
      <div className="relative z-10 container mx-auto px-8 py-10 text-white">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-bold mb-2">{siteTagline}</h1>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{siteName}</h2>
          <p className="text-lg mb-6">{siteDescription}</p>
          <button 
            onClick={() => scrollToSection('about')} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-semibold text-lg transition-colors"
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
            d="M0,96L80,85.3C160,75,320,53,480,53.3C640,53,800,75,960,80C1120,85,1280,75,1360,69.3L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z">
          </path>
        </svg>
      </div>
    </section>
  );
}
