import OrganizationStructure from "@/components/dashboard/organization-structure";
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
  divisionNames: {
    intelektual: string;
    public_relation: string;
    religius: string;
    technopreneurship: string;
    senor: string;
    medinfo: string;
  };
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

interface OrgMember {
  id: number;
  name: string;
  position: string;
  period: string;
  imageUrl: string;
}

const DIVISION_ORDER = [
  "Senor",
  "Public Relation",
  "Religius",
  "Technopreneurship",
  "Medinfo",
  "Intelektual",
];

export default function Hero({ scrollToSection }: HeroProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });

  // Urutan barisan sesuai permintaan user (dari kiri ke kanan)
  const barisan = [
    {
      type: "divisi",
      key: "senor",
      label: settings?.divisionNames?.senor || "Senor",
    },
    {
      type: "divisi",
      key: "public_relation",
      label: settings?.divisionNames?.public_relation || "Public Relation",
    },
    {
      type: "divisi",
      key: "religius",
      label: settings?.divisionNames?.religius || "Religius",
    },
    { type: "wakil" },
    { type: "ketua" },
    {
      type: "divisi",
      key: "technopreneurship",
      label: settings?.divisionNames?.technopreneurship || "Technopreneurship",
    },
    {
      type: "divisi",
      key: "medinfo",
      label: settings?.divisionNames?.medinfo || "Medinfo",
    },
    {
      type: "divisi",
      key: "intelektual",
      label: settings?.divisionNames?.intelektual || "Intelektual",
    },
  ];

  // Mapping warna background per kolom sesuai urutan barisan dan settings.divisionColors
  const divisionColors = (settings?.divisionColors ?? {}) as Record<
    string,
    string
  >;
  const gradientColors = [
    divisionColors["senor"] || "#FFA726",
    divisionColors["public_relation"] || "#9C27B0",
    divisionColors["religius"] || "#388E3C",
    divisionColors["leadership"] || "#2196F3", // untuk wakil & ketua
    divisionColors["leadership"] || "#2196F3",
    divisionColors["technopreneurship"] || "#00BCD4",
    divisionColors["medinfo"] || "#00ACC1",
    divisionColors["intelektual"] || "#5C6BC0",
  ];
  const gradientString = `linear-gradient(to right, ${gradientColors.join(
    ", "
  )})`;

  const getMember = (item: any) => {
    const divisionLogos = (settings?.divisionLogos ?? {}) as Record<
      string,
      string
    >;
    const divisionHeads = (settings?.divisionHeads ?? {}) as Record<
      string,
      any
    >;
    if (item.type === "ketua") {
      return {
        name: settings?.chairpersonName,
        photo: settings?.chairpersonPhoto,
        logo: settings?.logoUrl,
        title: settings?.chairpersonTitle || "Ketua Himpunan",
      };
    }
    if (item.type === "wakil") {
      return {
        name: settings?.viceChairpersonName,
        photo: settings?.viceChairpersonPhoto,
        logo: settings?.logoUrl,
        title: settings?.viceChairpersonTitle || "Wakil Ketua",
      };
    }
    if (item.type === "divisi" && typeof item.key === "string") {
      return {
        name: divisionHeads[item.key]?.name,
        photo: divisionHeads[item.key]?.photo,
        logo: divisionLogos[item.key],
        title: item.label,
      };
    }
    return null;
  };

  const sortedDivisions = DIVISION_ORDER.map(
    (name) => settings?.divisionHeads?.[name] || {}
  ).filter(Boolean);
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Banner dan gradient hanya setinggi banner */}
      <section className="relative w-full h-[400px]">
        {" "}
        {/* ganti sesuai tinggi benner */}
        <img
          src="./../attached_assets/bennerfull.png"
          alt="Banner"
          className="absolute top-0 left-0 w-full h-full object-cover z-0"
        />
        <div className="absolute bottom-0 left-0 w-full h-full z-10 bg-gradient-to-t from-white via-white/70 to-transparent"></div>
      </section>

      <div className="absolute top-0 left-0 w-full h-full z-20">
        <img
          src="./../attached_assets/orang.png"
          alt="Orang"
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-10 left-0 w-full h-1/2 z-10 bg-[linear-gradient(to_top,_rgba(255,255,255,1)_0%,_rgba(255,255,255,1)_20%,_rgba(255,255,255,0)_100%)]"></div>
      </div>
    </div>
  );
}
