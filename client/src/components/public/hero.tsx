interface HeroProps {
  scrollToSection: (id: string) => void;
}

export default function Hero({ scrollToSection }: HeroProps) {
  return (
    <section id="home" className="py-12 bg-gradient-to-r from-blue-500 to-blue-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:flex lg:items-center lg:justify-between">
          <div className="lg:w-1/2">
            <h1 className="text-4xl font-bold mb-6 font-serif">Himpunan Mahasiswa Teknik Informatika</h1>
            <p className="text-xl mb-8 font-light">Salam Satu Saudara Informatika</p>
            <p className="mb-8 text-lg">
              Kami adalah organisasi yang mewadahi seluruh mahasiswa Teknik Informatika di UIN Malang. 
              Bersama-sama kita membangun komunitas yang solid, berprestasi, dan bermanfaat bagi masyarakat.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => scrollToSection('about')} 
                className="bg-white text-blue-700 px-6 py-2 rounded-md font-medium hover:bg-gray-100 transition"
              >
                Selengkapnya
              </button>
              <button 
                onClick={() => scrollToSection('articles')} 
                className="bg-transparent border-2 border-white px-6 py-2 rounded-md font-medium hover:bg-white hover:text-blue-700 transition"
              >
                Baca Artikel
              </button>
            </div>
          </div>
          <div className="mt-10 lg:mt-0 lg:w-1/2">
            <img 
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop" 
              alt="Kegiatan Himpunan" 
              className="rounded-lg shadow-xl mx-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
