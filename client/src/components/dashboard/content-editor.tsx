import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Settings {
  _id?: string;
  id?: number;
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

interface ContentEditorProps {
  settings: Settings | undefined;
  onSave: () => void;
  onCancel: () => void;
}

export default function ContentEditor({ settings, onSave, onCancel }: ContentEditorProps) {
  const [aboutUs, setAboutUs] = useState(settings?.aboutUs || "");
  const [visionMission, setVisionMission] = useState(settings?.visionMission || "");
  const [selectedTab, setSelectedTab] = useState("about");
  const [logoUrl, setLogoUrl] = useState(settings?.logoUrl || "/logo.png");
  const [divisionLogos, setDivisionLogos] = useState(settings?.divisionLogos || {
    akademik: "/uploads/logo-akademik.png",
    humas: "/uploads/logo-humas.png",
    pengembangan: "/uploads/logo-pengembangan.png",
    media: "/uploads/logo-media.png",
    keuangan: "/uploads/logo-keuangan.png",
    acara: "/uploads/logo-acara.png"
  });
  const [divisionColors, setDivisionColors] = useState(settings?.divisionColors || {
    akademik: "rgba(233, 30, 99, 0.75)",
    humas: "rgba(156, 39, 176, 0.75)",
    pengembangan: "rgba(103, 58, 183, 0.75)",
    leadership: "rgba(33, 150, 243, 0.75)",
    media: "rgba(0, 188, 212, 0.75)",
    keuangan: "rgba(76, 175, 80, 0.75)",
    acara: "rgba(255, 152, 0, 0.75)"
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      return await apiRequest('PUT', '/api/settings', updatedSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Konten berhasil diperbarui",
        description: "Perubahan telah disimpan.",
      });
      onSave();
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast({
        title: "Gagal memperbarui konten",
        description: "Terjadi kesalahan saat menyimpan perubahan.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updatedSettings = {
      ...settings,
      aboutUs,
      visionMission,
      logoUrl,
      divisionLogos,
      divisionColors
    };
    updateMutation.mutate(updatedSettings);
  };
  
  const handleLogoChange = (newUrl: string) => {
    setLogoUrl(newUrl);
  };
  
  const handleDivisionLogoChange = (division: string, newUrl: string) => {
    setDivisionLogos(prev => ({
      ...prev,
      [division]: newUrl
    }));
  };
  
  const handleColorChange = (key: string, value: string) => {
    setDivisionColors(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePreview = (content: string) => {
    // Create a popup window with the content preview
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>Preview</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
              h1, h2, h3 { color: #2563eb; }
              ul, ol { margin-left: 20px; }
              li { margin-bottom: 8px; }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Edit Konten Halaman</h2>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="about">Tentang Kami</TabsTrigger>
          <TabsTrigger value="vision">Visi & Misi</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
          <TabsTrigger value="colors">Warna Divisi</TabsTrigger>
        </TabsList>
        
        <TabsContent value="about" className="space-y-4">
          <div>
            <Label htmlFor="aboutUs">Konten Tentang Kami (HTML)</Label>
            <div className="text-sm text-gray-500 mb-2">
              Gunakan format HTML untuk styling. Contoh: &lt;h2&gt;Judul&lt;/h2&gt;, &lt;p&gt;Paragraf&lt;/p&gt;, &lt;ul&gt;&lt;li&gt;Item&lt;/li&gt;&lt;/ul&gt;
            </div>
            <Textarea
              id="aboutUs"
              rows={15}
              value={aboutUs}
              onChange={(e) => setAboutUs(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => handlePreview(aboutUs)}
            type="button"
            className="mr-2"
          >
            Preview
          </Button>
        </TabsContent>
        
        <TabsContent value="vision" className="space-y-4">
          <div>
            <Label htmlFor="visionMission">Konten Visi & Misi</Label>
            <div className="text-sm text-gray-500 mb-2">
              Gunakan format khusus seperti contoh di bawah ini untuk struktur Visi & Misi
            </div>
            
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-700 mb-2">Petunjuk Format:</h4>
              <p className="text-sm text-blue-700">Gunakan format berikut:</p>
              <pre className="text-xs bg-white p-2 rounded mt-1 text-blue-900 overflow-auto">
{`VISI MISI

- VISI
[Tuliskan visi organisasi di sini]

- MISI
* [Poin misi pertama]
* [Poin misi kedua]
* [Dan seterusnya...]`}
              </pre>
            </div>
            
            <Textarea
              id="visionMission"
              rows={15}
              value={visionMission}
              onChange={(e) => setVisionMission(e.target.value)}
              className="font-mono text-sm"
              placeholder={`VISI MISI

- VISI
Mewujudkan Himpunan Mahasiswa Teknik Informatika yang berintegritas, progresif, dan adaptif sebagai wadah kolaborasi yang responsif, transparan, partisipatif, menjunjung tinggi nilai kekeluargaan, menciptakan lingkungan yang harmonis, inovatif, dan berorientasi pada kemajuan berkelanjutan.

- MISI
* Meningkatkan lingkungan yang kondusif untuk dialog terbuka, penguatan solidaritas, dan pengamalan kepedulian kolektif, dengan semangat kebersamaan untuk mendukung hubungan yang harmonis dan produktif antar anggota.
* Mengintegrasikan nilai-nilai budaya lokal, nasional, dan profesionalisme dalam setiap program kerja, menumbuhkan kesadaran akan tanggung jawab sosial, meningkatkan kompetensi akademik, soft skills, kepemimpinan, dan inovasi teknologi melalui berbagai kegiatan produktif.
* Mengoptimalkan peran Himpunan sebagai wadah pemberdayaan anggota dengan memberikan perhatian terhadap aspirasi, memfasilitasi pengembangan diri, dan menciptakan jaringan kolaborasi yang efektif dengan berbagai pihak untuk mendorong kontribusi aktif dalam pembangunan dan pengembangan organisasi.`}
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => handlePreview(visionMission)}
            type="button"
            className="mr-2"
          >
            Preview
          </Button>
        </TabsContent>

        <TabsContent value="logo" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Logo Himpunan</h3>
              <div className="mb-4">
                <Label>Logo Utama</Label>
                <div className="mt-2">
                  <div className="flex items-center gap-4">
                    <img 
                      src={logoUrl} 
                      alt="Logo Himpunan" 
                      className="h-20 w-20 object-contain border rounded-md p-2" 
                    />
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            try {
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                body: formData,
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                handleLogoChange(data.url);
                                toast({
                                  title: "Upload berhasil",
                                  description: "Logo telah diperbarui",
                                });
                              }
                            } catch (error) {
                              console.error('Error uploading file:', error);
                              toast({
                                title: "Upload gagal",
                                description: "Terjadi kesalahan saat mengunggah logo",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        className="max-w-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Logo Divisi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(divisionLogos).map(([division, logoUrl]) => (
                  <div key={division} className="p-4 border rounded-md">
                    <Label className="capitalize mb-2 block">{division}</Label>
                    <div className="flex flex-col gap-2">
                      <img 
                        src={logoUrl} 
                        alt={`Logo ${division}`}
                        className="h-16 w-16 object-contain mb-2 border rounded-md p-1" 
                      />
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            try {
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                body: formData,
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                handleDivisionLogoChange(division, data.url);
                                toast({
                                  title: "Upload berhasil",
                                  description: `Logo divisi ${division} telah diperbarui`,
                                });
                              }
                            } catch (error) {
                              console.error('Error uploading file:', error);
                              toast({
                                title: "Upload gagal",
                                description: "Terjadi kesalahan saat mengunggah logo",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Warna Divisi</h3>
              <p className="text-sm text-gray-500 mb-4">
                Sesuaikan warna latar belakang untuk tiap divisi di hero section
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(divisionColors).map(([key, color]) => (
                  <div key={key} className="p-4 border rounded-md">
                    <Label className="capitalize mb-2 block">{key}</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-md border" 
                        style={{ backgroundColor: color }}
                      ></div>
                      <Input
                        type="text"
                        value={color}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="font-mono text-sm"
                      />
                      <input
                        type="color"
                        value={color.startsWith('rgba') 
                          ? `#${color.match(/\d+/g)?.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`
                          : color
                        }
                        onChange={(e) => {
                          const hex = e.target.value;
                          // Conver hex to rgba
                          const r = parseInt(hex.slice(1, 3), 16);
                          const g = parseInt(hex.slice(3, 5), 16);
                          const b = parseInt(hex.slice(5, 7), 16);
                          const rgba = `rgba(${r}, ${g}, ${b}, 0.75)`;
                          handleColorChange(key, rgba);
                        }}
                        className="w-10 h-10 p-1 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button 
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </div>
  );
}