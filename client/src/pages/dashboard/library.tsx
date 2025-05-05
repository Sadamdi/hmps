import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import MediaUploader from "@/components/dashboard/media-uploader";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Search, Plus, Loader2, ImageIcon, VideoIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LibraryItem {
  id: number;
  title: string;
  description: string;
  fullDescription: string;
  images: string[];
  date: string;
  time: string;
  type: "photo" | "video";
  createdAt: string;
}

export default function DashboardLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query library items
  const { data: libraryItems = [], isLoading } = useQuery({
    queryKey: ['/api/library/manage'],
  });

  // Delete library item mutation
  const deleteLibraryItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest('DELETE', `/api/library/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
      console.error("Delete error:", error);
    },
  });

  // Filter items based on search and tab
  const filteredItems = libraryItems
    .filter((item: LibraryItem) => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((item: LibraryItem) => {
      if (activeTab === "all") return true;
      if (activeTab === "photos") return item.type === "photo";
      if (activeTab === "videos") return item.type === "video";
      return true;
    });
  
  const handleNewItem = () => {
    setEditingItem(null);
    setIsUploaderOpen(true);
  };

  const handleEditItem = (item: LibraryItem) => {
    setEditingItem(item);
    setIsUploaderOpen(true);
  };

  const handleDeleteItem = async (itemId: number) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      await deleteLibraryItemMutation.mutateAsync(itemId);
    }
  };

  const closeUploader = () => {
    setIsUploaderOpen(false);
    setEditingItem(null);
  };

  const handleItemSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
    closeUploader();
    toast({
      title: "Success",
      description: `Library item ${editingItem ? "updated" : "created"} successfully`,
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Library" />
        <main className="flex-1 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <h1 className="text-2xl font-bold">Media Library</h1>
            <Button onClick={handleNewItem}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Media
            </Button>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search library..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 mb-4">No media items found.</p>
                <Button onClick={handleNewItem}>Upload Media</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item: LibraryItem) => (
                <Card key={item.id} className="overflow-hidden">
                  <div className="h-48 relative overflow-hidden group">
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                    />
                    
                    {/* Type indicator */}
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs rounded px-2 py-1 flex items-center">
                      {item.type === 'photo' ? (
                        <>
                          <ImageIcon className="h-3 w-3 mr-1" />
                          <span>Photo{item.images.length > 1 ? ` (${item.images.length})` : ''}</span>
                        </>
                      ) : (
                        <>
                          <VideoIcon className="h-3 w-3 mr-1" />
                          <span>Video</span>
                        </>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold truncate">{item.title}</h3>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                      <div className="text-xs text-gray-500">
                        {item.date} · {item.time}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={isUploaderOpen} onOpenChange={setIsUploaderOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Media Item" : "Upload New Media"}
                </DialogTitle>
              </DialogHeader>
              <MediaUploader 
                item={editingItem} 
                onSave={handleItemSaved} 
                onCancel={closeUploader}
              />
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
