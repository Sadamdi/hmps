import { useQuery } from "@tanstack/react-query";

interface OrgMember {
  id: number;
  name: string;
  position: string;
  period: string;
  imageUrl: string;
}

export default function Structure() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['/api/organization/members'],
    placeholderData: []
  });

  return (
    <section id="structure" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">Struktur Organisasi</h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Kepengurusan Himpunan Mahasiswa Teknik Informatika 2023/2024</p>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-pulse space-y-8 w-full">
              <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-lg shadow-md h-80">
                    <div className="w-full aspect-square bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-6 mt-10">
            {members.map((member: OrgMember) => (
              <div key={member.id} className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <div className="w-full aspect-square overflow-hidden rounded-lg mb-4">
                  <img 
                    src={member.imageUrl} 
                    alt={member.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-lg">{member.name}</h3>
                <p className="text-primary font-medium">{member.position}</p>
                <p className="text-gray-500 text-sm mt-1">{member.period}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
