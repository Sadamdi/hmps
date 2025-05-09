import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
      visionMission
    };
    updateMutation.mutate(updatedSettings);
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
            <Label htmlFor="visionMission">Konten Visi & Misi (HTML)</Label>
            <div className="text-sm text-gray-500 mb-2">
              Gunakan format HTML untuk styling. Contoh: &lt;h2&gt;Judul&lt;/h2&gt;, &lt;p&gt;Paragraf&lt;/p&gt;, &lt;ol&gt;&lt;li&gt;Item&lt;/li&gt;&lt;/ol&gt;
            </div>
            <Textarea
              id="visionMission"
              rows={15}
              value={visionMission}
              onChange={(e) => setVisionMission(e.target.value)}
              className="font-mono text-sm"
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