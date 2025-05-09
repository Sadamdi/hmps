import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileEdit } from "lucide-react";

import Header from "@/components/dashboard/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ContentEditor from "@/components/dashboard/content-editor";
import { useAuth } from "@/lib/auth";

export default function Content() {
  const [isEditing, setIsEditing] = useState(false);
  const { data: settings, isPending } = useQuery({
    queryKey: ['/api/settings'],
    refetchOnWindowFocus: false,
  });
  
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['owner', 'admin', 'chair', 'vice_chair']);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
  };

  return (
    <div>
      <Header title="Konten Halaman Publik" />
      
      {isEditing ? (
        <div className="mb-4">
          <Button 
            variant="ghost" 
            onClick={handleCancelEdit}
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        </div>
      ) : null}

      {isPending ? (
        <div className="text-center p-8">Memuat data...</div>
      ) : isEditing ? (
        <ContentEditor
          settings={settings}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Konten Halaman</h2>
            {canEdit && (
              <Button onClick={handleEdit}>
                <FileEdit className="mr-2 h-4 w-4" />
                Edit Konten
              </Button>
            )}
          </div>
          
          <Tabs defaultValue="about">
            <TabsList>
              <TabsTrigger value="about">Tentang Kami</TabsTrigger>
              <TabsTrigger value="vision">Visi & Misi</TabsTrigger>
            </TabsList>
            
            <TabsContent value="about">
              <Card>
                <CardHeader>
                  <CardTitle>Konten Tentang Kami</CardTitle>
                  <CardDescription>
                    Konten ini akan ditampilkan di bagian "Tentang Kami" pada halaman publik
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {settings?.aboutUs ? (
                    <div className="prose max-w-none border rounded-md p-4 bg-gray-50">
                      <div dangerouslySetInnerHTML={{ __html: settings.aboutUs }} />
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">Belum ada konten.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="vision">
              <Card>
                <CardHeader>
                  <CardTitle>Konten Visi & Misi</CardTitle>
                  <CardDescription>
                    Konten ini akan ditampilkan di bagian "Visi & Misi" pada halaman publik
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {settings?.visionMission ? (
                    <div className="prose max-w-none border rounded-md p-4 bg-gray-50">
                      <div dangerouslySetInnerHTML={{ __html: settings.visionMission }} />
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">Belum ada konten.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}