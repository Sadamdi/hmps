import { useQuery } from "@tanstack/react-query";

interface HeroProps {
  scrollToSection: (id: string) => void;
}

export default function Hero({ scrollToSection }: HeroProps) {
  // Fetch settings for site name and tagline
  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });
  
  // Fetch organization members to display the leaders
  const { data: members } = useQuery({
    queryKey: ['/api/organization/members'],
    staleTime: 1000,
  });
  
  // Get site name and tagline from settings with fallbacks
  const siteName = settings?.siteName || "Himpunan Mahasiswa Teknik Informatika";
  const siteTagline = settings?.siteTagline || "Salam Satu Saudara Informatika";
  const siteDescription = settings?.siteDescription || "HMPS Teknik Informatika \"Encoder\" 2023";
  
  // Filter members by position
  const chairperson = members?.find((m: any) => 
    m.position === "Ketua Umum" || m.position.toLowerCase().includes("ketua umum")
  );
  
  const viceChairperson = members?.find((m: any) => 
    m.position === "Wakil Ketua" || m.position.toLowerCase().includes("wakil ketua")
  );
  
  const divisionHeads = members?.filter((m: any) => 
    m.position.toLowerCase().includes("kepala divisi") || 
    m.position.toLowerCase().includes("ketua divisi")
  );

  return (
    <section id="home" className="relative min-h-screen pt-16 pb-32 overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 flex flex-col justify-end">
      {/* Overlay with pattern */}
      <div className="absolute inset-0 opacity-20 mix-blend-overlay">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] bg-repeat"></div>
      </div>
      
      {/* Logo at center top */}
      <div className="relative z-10 mx-auto mt-8 mb-12">
        <img 
          src="/logo.png" 
          alt="Logo Himpunan" 
          className="w-32 h-32 md:w-40 md:h-40 mx-auto"
        />
      </div>
      
      {/* Text content */}
      <div className="relative z-10 container mx-auto px-6 text-white">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">{siteTagline}</h1>
          <h2 className="text-2xl md:text-4xl font-bold mb-6">{siteName}</h2>
          <p className="text-lg mb-8">{siteDescription}</p>
          <button 
            onClick={() => scrollToSection('about')} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-semibold text-lg transition-colors"
          >
            SELENGKAPNYA
          </button>
        </div>
      </div>
      
      {/* People display */}
      <div className="relative mt-12 z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center">
            {/* Division Heads (Left) */}
            <div className="w-full md:w-1/4 flex flex-wrap">
              {divisionHeads?.slice(0, 3).map((head: any, index: number) => (
                <div key={head._id || index} className="w-1/3 md:w-full px-1">
                  <img 
                    src={head.imageUrl || "/default-user.png"} 
                    alt={head.name} 
                    className="w-full aspect-square object-cover object-top"
                  />
                </div>
              ))}
            </div>
            
            {/* Chair and Vice Chair (Center) */}
            <div className="w-full md:w-2/4 flex justify-center px-2">
              {chairperson && (
                <div className="w-1/2 px-1">
                  <img 
                    src={chairperson.imageUrl || "/default-user.png"} 
                    alt={chairperson.name} 
                    className="w-full aspect-square object-cover object-top"
                  />
                </div>
              )}
              
              {viceChairperson && (
                <div className="w-1/2 px-1">
                  <img 
                    src={viceChairperson.imageUrl || "/default-user.png"} 
                    alt={viceChairperson.name} 
                    className="w-full aspect-square object-cover object-top"
                  />
                </div>
              )}
            </div>
            
            {/* Division Heads (Right) */}
            <div className="w-full md:w-1/4 flex flex-wrap">
              {divisionHeads?.slice(3, 6).map((head: any, index: number) => (
                <div key={head._id || index} className="w-1/3 md:w-full px-1">
                  <img 
                    src={head.imageUrl || "/default-user.png"} 
                    alt={head.name} 
                    className="w-full aspect-square object-cover object-top"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Wave decoration at bottom */}
      <div className="absolute bottom-0 left-0 right-0 w-full">
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
