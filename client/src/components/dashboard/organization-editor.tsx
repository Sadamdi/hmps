import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User } from "lucide-react";

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(member?.imageUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available positions
  const positions = [
    "Ketua Himpunan",
    "Wakil Ketua Himpunan",
    "Ketua Divisi Akademik",
    "Ketua Divisi Humas",
    "Ketua Divisi Pengembangan",
    "Ketua Divisi Kegiatan",
    "Ketua Divisi Media",
    "Ketua Divisi Dana & Usaha"
  ];

  // Available periods (academic years)
  const periods = [
    "2023-2024",
    "2022-2023",
    "2021-2022",
    "2020-2021"
  ];

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
          <Select 
            value={period} 
            onValueChange={setPeriod}
          >
            <SelectTrigger id="period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
