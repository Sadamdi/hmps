import { GDriveLinkInput } from "@/components/GDriveLinkInput";
import { MediaDisplay } from "@/components/MediaDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Image, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Article {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  published: boolean;
}

interface ArticleEditorProps {
  article: Article | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function ArticleEditor({
  article,
  onSave,
  onCancel,
}: ArticleEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState(article?.title || "");
  const [excerpt, setExcerpt] = useState(article?.excerpt || "");
  const [content, setContent] = useState(article?.content || "");
  const [imageUrl, setImageUrl] = useState(article?.image || "");
  const [gdriveUrl, setGdriveUrl] = useState("");
  const [isGdriveValid, setIsGdriveValid] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | undefined>();
  const [isPublished, setIsPublished] = useState(article?.published || false);
  const [activeTab, setActiveTab] = useState("edit");
  const contentImageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setImagePreview(imageUrl);
      setImageUrl(imageUrl);
    }
  };

  const saveArticleMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const articleId = (article as any)?._id || article?.id;
      return articleId
        ? apiRequest("PUT", `/api/articles/${articleId}`, formData)
        : apiRequest("POST", "/api/articles", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/manage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onSave();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save the article. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadContentImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return apiRequest("POST", "/api/upload/content-image", formData);
    },
    onSuccess: (data) => {
      const imageTag = `<img src="${data.url}" alt="Content image" class="my-4 max-w-full" />`;
      setContent((prev) => prev + "\n" + imageTag);
      toast({ title: "Success", description: "Image inserted." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload image.",
        variant: "destructive",
      });
    },
  });

  const handleContentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadContentImageMutation.mutateAsync(file);
    }
  };

  const handleGdriveValidation = (isValid: boolean, error?: string) => {
    setIsGdriveValid(isValid);
    setGdriveError(error);
    if (isValid && gdriveUrl) setImageUrl(gdriveUrl);
  };

  const applyFormatting = (format: string) => {
    const textarea = document.querySelector(
      'textarea[placeholder*="Write your article"]'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);

    let formattedText = "";

    switch (format) {
      case "bold":
        formattedText = selectedText
          ? `<strong>${selectedText}</strong>`
          : "<strong>Bold text</strong>";
        break;
      case "italic":
        formattedText = selectedText
          ? `<em>${selectedText}</em>`
          : "<em>Italic text</em>";
        break;
      case "underline":
        formattedText = selectedText
          ? `<u>${selectedText}</u>`
          : "<u>Underlined text</u>";
        break;
      case "h1":
        formattedText = `<h1>${selectedText || "Heading 1"}</h1>`;
        break;
      case "h2":
        formattedText = `<h2>${selectedText || "Heading 2"}</h2>`;
        break;
      case "h3":
        formattedText = `<h3>${selectedText || "Heading 3"}</h3>`;
        break;
      case "h4":
        formattedText = `<h4>${selectedText || "Heading 4"}</h4>`;
        break;
      case "h5":
        formattedText = `<h5>${selectedText || "Heading 5"}</h5>`;
        break;
      case "h6":
        formattedText = `<h6>${selectedText || "Heading 6"}</h6>`;
        break;
      case "ul":
        formattedText =
          "<ul>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ul>";
        break;
      case "ol":
        formattedText =
          "<ol>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ol>";
        break;
      case "blockquote":
        formattedText = `<blockquote>${
          selectedText || "Quote text"
        }</blockquote>`;
        break;
      case "code":
        formattedText = `<code>${selectedText || "Code text"}</code>`;
        break;
      case "pre":
        formattedText = `<pre><code>${
          selectedText || "Code block"
        }</code></pre>`;
        break;
      default:
        formattedText = selectedText;
    }

    const newContent = beforeText + formattedText + afterText;
    setContent(newContent);

    setTimeout(() => {
      const newPosition = start + formattedText.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
  };

  const handleSave = async () => {
    if (!title.trim() || !excerpt.trim() || !content.trim()) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    if (!imageUrl && !gdriveUrl) {
      toast({
        title: "Error",
        description: "Provide a Google Drive image link",
        variant: "destructive",
      });
      return;
    }
    if (gdriveUrl && !isGdriveValid) {
      toast({
        title: "Error",
        description: gdriveError || "Invalid Google Drive link",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("excerpt", excerpt);
    formData.append("content", content);
    formData.append("published", isPublished.toString());
    if (gdriveUrl && isGdriveValid) formData.append("gdriveUrl", gdriveUrl);

    await saveArticleMutation.mutateAsync(formData);
    setTitle("");
    setExcerpt("");
    setContent("");
    setImagePreview("");
    toast({ title: "Success", description: "Article saved." });
  };

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Article Title</Label>
          <Input
            id="title"
            placeholder="Enter article title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Short Excerpt</Label>
          <Textarea
            id="excerpt"
            placeholder="Brief description (shown in article previews)"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="thumbnail">Thumbnail Image</Label>
          <div className="flex items-center space-x-4">
            <div
              className="w-32 h-32 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Thumbnail Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Upload className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Image
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="space-y-4 pt-4">
            <div className="border rounded-md p-3 bg-gray-50 space-y-2">
              {/* Text Formatting */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("bold")}
                  title="Bold"
                >
                  <strong>B</strong>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("italic")}
                  title="Italic"
                >
                  <em>I</em>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("underline")}
                  title="Underline"
                >
                  <u>U</u>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("code")}
                  title="Inline Code"
                >
                  &lt;/&gt;
                </Button>
              </div>

              {/* Headings */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-600 self-center mr-2">
                  Headings:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("h1")}
                  title="Heading 1"
                >
                  H1
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("h2")}
                  title="Heading 2"
                >
                  H2
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("h3")}
                  title="Heading 3"
                >
                  H3
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("h4")}
                  title="Heading 4"
                >
                  H4
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("h5")}
                  title="Heading 5"
                >
                  H5
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("h6")}
                  title="Heading 6"
                >
                  H6
                </Button>
              </div>

              {/* Lists and Blocks */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-600 self-center mr-2">
                  Lists & Blocks:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("ul")}
                  title="Bullet List"
                >
                  • List
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("ol")}
                  title="Numbered List"
                >
                  1. List
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("blockquote")}
                  title="Quote"
                >
                  " Quote
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyFormatting("pre")}
                  title="Code Block"
                >
                  Code Block
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => contentImageInputRef.current?.click()}
                  disabled={uploadContentImageMutation.isPending}
                  title="Add Image"
                >
                  {uploadContentImageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Image className="h-4 w-4" />
                  )}
                  <span className="ml-1">Image</span>
                </Button>
                <input
                  ref={contentImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleContentImageUpload}
                />
              </div>
            </div>
            <Textarea
              placeholder="Write your article content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
            />
            <p className="text-sm text-gray-500">
              Note: In a real implementation, a full WYSIWYG editor like
              TinyMCE, CKEditor, or Quill would be used here.
            </p>
          </TabsContent>
          <TabsContent value="preview" className="pt-4">
            <div className="border rounded-md p-6 min-h-[400px] prose max-w-none">
              <h1 className="text-2xl font-bold mb-4">{title}</h1>
              <div dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center space-x-2">
          <Switch
            id="published"
            checked={isPublished}
            onCheckedChange={setIsPublished}
          />
          <Label htmlFor="published">
            {isPublished ? "Published" : "Draft"}
          </Label>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saveArticleMutation.isPending}>
          {saveArticleMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Article"
          )}
        </Button>
      </div>
    </div>
  );
}
