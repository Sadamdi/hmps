import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

interface MediaUploaderProps {
  item: LibraryItem | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function MediaUploader({
  item,
  onSave,
  onCancel,
}: MediaUploaderProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [fullDescription, setFullDescription] = useState(
    item?.fullDescription || ""
  );
  const [mediaType, setMediaType] = useState<"photo" | "video">(
    item?.type || "photo"
  );
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>(item?.images || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save media mutation
  const saveMediaMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (item) {
        // Update existing item - Use MongoDB _id or PostgreSQL id
        const itemId = (item as any)._id || item.id;

        console.log("Updating library item with ID:", itemId);

        if (!itemId) {
          throw new Error("Invalid item ID");
        }

        return await apiRequest("PUT", `/api/library/${itemId}`, formData);
      } else {
        // Create new item
        return await apiRequest("POST", "/api/library", formData);
      }
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      // Clear form after successful upload
      setTitle("");
      setDescription("");
      setFullDescription("");
      setFiles([]);
      setPreviews([]);

      toast({
        title: "Success",
        description: "Media uploaded successfully",
      });

      onSave();
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || // kalau pakai axios & server kirim error message
        error?.message || // pesan dari error JS biasa
        "Failed to save the media item. Please try again."; // fallback

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });

      console.error("Save error:", error);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    // Create array from FileList
    const filesArray = Array.from(selectedFiles);

    // Add the new files to the existing files
    setFiles((prev) => [...prev, ...filesArray]);

    // Create preview URLs
    const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    // Remove file from files array
    setFiles((prevFiles) => {
      const newFiles = [...prevFiles];
      newFiles.splice(index, 1);
      return newFiles;
    });

    // If it's a new preview (blob URL), revoke it to avoid memory leaks
    if (previews[index].startsWith("blob:")) {
      URL.revokeObjectURL(previews[index]);
    }

    // Remove preview
    setPreviews((prevPreviews) => {
      const newPreviews = [...prevPreviews];
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please provide a short description",
        variant: "destructive",
      });
      return;
    }

    if (previews.length === 0) {
      toast({
        title: "Error",
        description: "Please upload at least one media file",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("fullDescription", fullDescription);
      formData.append("type", mediaType);

      // Append existing images that aren't new uploads
      if (item) {
        item.images.forEach((img, index) => {
          // Check if this image is still in previews (not removed)
          if (previews.includes(img)) {
            formData.append(`existingImages[${index}]`, img);
          }
        });
      }

      // Append new files
      files.forEach((file, index) => {
        formData.append(`images`, file);
      });

      await saveMediaMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload media. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previews.forEach((preview) => {
        if (preview.startsWith("blob:")) {
          URL.revokeObjectURL(preview);
        }
      });
    };
  }, [previews]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Enter media title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Short Description</Label>
          <Textarea
            id="description"
            placeholder="Brief description (shown in previews)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullDescription">Full Description</Label>
          <Textarea
            id="fullDescription"
            placeholder="Detailed description (shown when item is opened)"
            value={fullDescription}
            onChange={(e) => setFullDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-3">
          <Label>Media Type</Label>
          <RadioGroup
            value={mediaType}
            onValueChange={(value) => setMediaType(value as "photo" | "video")}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="photo" id="photo" />
              <Label htmlFor="photo" className="flex items-center">
                <ImageIcon className="h-4 w-4 mr-1" />
                Photo
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="video" id="video" />
              <Label htmlFor="video" className="flex items-center">
                <Video className="h-4 w-4 mr-1" />
                Video
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Media Files</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
            {previews.map((preview, index) => (
              <div
                key={index}
                className="relative h-24 bg-gray-100 rounded-md overflow-hidden"
              >
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="h-24 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <Plus className="h-6 w-6 text-gray-400" />
              <span className="text-sm text-gray-500 mt-1">Add Media</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={mediaType === "photo" ? "image/*" : "video/*"}
            className="hidden"
            onChange={handleFileChange}
            multiple={mediaType === "photo"}
          />
          <p className="text-sm text-gray-500 mt-2">
            {mediaType === "photo"
              ? "You can upload multiple photos"
              : "Please upload a single video file"}
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saveMediaMutation.isPending}>
          {saveMediaMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
