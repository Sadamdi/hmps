import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Plus } from "lucide-react";

interface OrgMember {
  id: number;
  name: string;
  position: string;
  period: string;
  imageUrl: string;
}

interface OrganizationEditorProps {
  member: OrgMember | null;
  currentPeriod: string;
  onSave: () => void;
  onCancel: () => void;
}

export default function OrganizationEditor({ member, currentPeriod, onSave, onCancel }: OrganizationEditorProps) {
  const { toast } = useToast();
  const [name, setName] = useState(member?.name || "");
  const [position, setPosition] = useState(member?.position || "");
  const [period, setPeriod] = useState(member?.period || currentPeriod);
  const [newPeriod, setNewPeriod] = useState("");
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(member?.imageUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available positions
  const positions = [
    "Ketua Umum",
    "Wakil Ketua",
    "Kepala Divisi Akademik",
    "Kepala Divisi Humas",
    "Kepala Divisi Pengembangan",
    "Kepala Divisi Acara",
    "Kepala Divisi Media",
    "Kepala Divisi Keuangan",
    "Anggota Divisi Akademik",
    "Anggota Divisi Humas",
    "Anggota Divisi Pengembangan",
    "Anggota Divisi Acara",
    "Anggota Divisi Media",
    "Anggota Divisi Keuangan"
  ];

  // Fetch available periods from API
  const { data: periods = [], isLoading: isPeriodsLoading } = useQuery({
    queryKey: ['/api/organization/periods'],
    placeholderData: [currentPeriod]
  });

  // We already imported queryClient, so no need to get it again

  // Save member mutation
  const saveMemberMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (member) {
        // Update existing member
        return await apiRequest('PUT', `/api/organization/members/${member.id}`, formData);
      } else {
        // Create new member
        return await apiRequest('POST', '/api/organization/members', formData);
      }
    },
    onSuccess: () => {
      // Invalidate both organization queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/organization/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organization/periods'] });
      onSave();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save the organization member. Please try again.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    if (!position) {
      toast({
        title: "Error",
        description: "Please select a position",
        variant: "destructive",
      });
      return;
    }

    if (!period) {
      toast({
        title: "Error",
        description: "Please select a period",
        variant: "destructive",
      });
      return;
    }

    if (!imagePreview && !imageFile) {
      toast({
        title: "Error",
        description: "Please upload a profile image",
        variant: "destructive",
      });
      return;
    }

    // Create FormData for file upload
    const formData = new FormData();
    formData.append("name", name);
    formData.append("position", position);
    formData.append("period", period);
    
    if (imageFile) {
      formData.append("image", imageFile);
    }

    await saveMemberMutation.mutateAsync(formData);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400 flex items-center justify-center bg-gray-50"
          >
            {imagePreview ? (
              <img 
                src={imagePreview} 
                alt="Profile Preview" 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-12 w-12 text-gray-400" />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-50 text-white text-xs text-center py-1">
              {imagePreview ? "Change" : "Upload"}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Enter full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Select 
            value={position} 
            onValueChange={setPosition}
          >
            <SelectTrigger id="position">
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {positions.map(pos => (
                <SelectItem key={pos} value={pos}>{pos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">Period</Label>
          {!isAddingPeriod ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Select 
                  value={period} 
                  onValueChange={setPeriod}
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p: string) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => setIsAddingPeriod(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="YYYY-YYYY (e.g. 2023-2024)"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
              />
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => {
                  if (newPeriod && /^\d{4}-\d{4}$/.test(newPeriod)) {
                    // Check if this period already exists
                    if (periods.includes(newPeriod)) {
                      toast({
                        title: "Period Exists",
                        description: "This period already exists. Please use a different year range.",
                        variant: "destructive"
                      });
                    } else {
                      // Add the new period to both local state and server
                      setPeriod(newPeriod);
                      // The periods will be automatically updated by the server when a new member is created
                      setIsAddingPeriod(false);
                      
                      // Show confirmation
                      toast({
                        title: "New Period Added",
                        description: `Period ${newPeriod} has been created and selected.`,
                      });
                    }
                  } else {
                    toast({
                      title: "Invalid Format",
                      description: "Please use the format YYYY-YYYY (e.g. 2023-2024)",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Add
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  setNewPeriod("");
                  setIsAddingPeriod(false);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saveMemberMutation.isPending}
        >
          {saveMemberMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  );
}
