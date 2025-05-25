import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, User } from "lucide-react";
import { useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage"; // kita buat fungsi ini sendiri di langkah berikutnya
import { Dialog, DialogContent } from "@/components/ui/dialog"; // asumsi kamu pakai komponen modal/dialog
import type { Area } from "react-easy-crop";

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

export default function OrganizationEditor({
  member,
  currentPeriod,
  onSave,
  onCancel,
}: OrganizationEditorProps) {
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
    "Ketua Himpunan",
    "Wakil Ketua Himpunan",
    "Ketua Divisi Senor",
    "Ketua Divisi Public Relation",
    "Ketua Divisi Religius",
    "Ketua Divisi Technopreneurship",
    "Ketua Divisi Medinfo",
    "Ketua Divisi Intelektual",
    "Anggota Divisi Senor",
    "Anggota Divisi Public Relation",
    "Anggota Divisi Religius",
    "Anggota Divisi Technopreneurship",
    "Anggota Divisi Medinfo",
    "Anggota Divisi Intelektual",
  ];

  // Fetch available periods from API
  const { data: periods = [], isLoading: isPeriodsLoading } = useQuery({
    queryKey: ["/api/organization/periods"],
    placeholderData: [currentPeriod],
  });

  // We already imported queryClient, so no need to get it again

  // Save member mutation
  const saveMemberMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (member) {
        // Update existing member - Use MongoDB _id or PostgreSQL id
        const memberId = (member as any)._id || member.id;

        console.log("Updating organization member with ID:", memberId);

        if (!memberId) {
          throw new Error("Invalid member ID");
        }
        return await apiRequest(
          "PUT",
          `/api/organization/members/${memberId}`,
          formData
        );
      } else {
        // Create new member
        return await apiRequest("POST", "/api/organization/members", formData);
      }
    },
    onSuccess: () => {
      // Invalidate both organization queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/members"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/periods"],
      });
      onSave();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          "Failed to save the organization member. Please try again.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

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

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("name", name);
      formData.append("position", position);
      formData.append("period", period);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      await saveMemberMutation.mutateAsync(formData);

      // Clear form after successful upload
      setName("");
      setPosition("");
      setPeriod("");
      setImageFile(null);
      setImagePreview("");

      toast({
        title: "Success",
        description: "Member data saved successfully",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Failed to save member data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropDone = async () => {
    if (selectedImage && croppedAreaPixels) {
      const croppedImage = await getCroppedImg(
        selectedImage,
        croppedAreaPixels
      );
      if (croppedImage) {
        setImagePreview(URL.createObjectURL(croppedImage));
        setImageFile(croppedImage);
        setCropModalOpen(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent className="w-full max-w-lg p-4">
          <div className="relative w-full h-96 bg-black">
            {selectedImage && (
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPixels) => {
                  setCroppedAreaPixels(croppedAreaPixels);
                }}
              />
            )}
          </div>
          <p className="text-xs text-gray-500">nb: (scroll to zoom)</p>
          <div className="flex justify-end mt-4 space-x-2">
            <Button variant="outline" onClick={() => setCropModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCropDone}>Crop</Button>
          </div>
        </DialogContent>
      </Dialog>

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
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger id="position">
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((pos) => (
                <SelectItem key={pos} value={pos}>
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">Period</Label>
          {!isAddingPeriod ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p: string) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
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
                        description:
                          "This period already exists. Please use a different year range.",
                        variant: "destructive",
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
                      description:
                        "Please use the format YYYY-YYYY (e.g. 2023-2024)",
                      variant: "destructive",
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
        <Button onClick={handleSave} disabled={saveMemberMutation.isPending}>
          {saveMemberMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
