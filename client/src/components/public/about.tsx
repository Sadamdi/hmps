import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

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
  socialLinks: {
    facebook: string;
    twitter: string;
    instagram: string;
    youtube: string;
  };
}

interface LibraryItem {
  _id: string;
  title: string;
  description: string;
  imageUrls: string[];
  imageSources: string[];
  gdriveFileIds: string[];
  type: "photo" | "video";
  createdAt: string;
}

interface Article {
  _id: string;
  title: string;
  image: string;
  imageSource: string;
  gdriveFileId?: string;
  published: boolean;
}

// Generate random positions for floating images with varied sizes
const generateRandomPositions = (count: number, side: "left" | "right") => {
  const positions = [];
  const baseX = side === "left" ? 1 : 1; // Distance from edge
  const maxX = 12; // Maximum distance from edge

  // Define different size categories for more variety
  const sizeCategories = [
    { min: 50, max: 70 }, // Extra small
    { min: 80, max: 100 }, // Small
    { min: 110, max: 140 }, // Medium
    { min: 150, max: 180 }, // Large
    { min: 190, max: 220 }, // Extra large
  ];

  for (let i = 0; i < count; i++) {
    // Pick random size category
    const sizeCategory =
      sizeCategories[Math.floor(Math.random() * sizeCategories.length)];
    const size =
      Math.random() * (sizeCategory.max - sizeCategory.min) + sizeCategory.min;

    positions.push({
      x: Math.random() * (maxX - baseX) + baseX,
      y: Math.random() * 75 + 12.5, // 12.5% to 87.5% from top
      delay: Math.random() * 6, // Random animation delay up to 6s
      size: size,
      rotation: Math.random() * 8 - 4, // Random rotation -4 to +4 degrees
      duration: Math.random() * 6 + 10, // Animation duration 10-16 seconds
    });
  }
  return positions;
};

// Animated Gallery Component with random positioning
function AnimatedGallery({
  images,
  direction = "up",
  side,
}: {
  images: string[];
  direction?: "up" | "down";
  side: "left" | "right";
}) {
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [positions, setPositions] = useState<
    Array<{
      x: number;
      y: number;
      delay: number;
      size: number;
      rotation: number;
      duration: number;
    }>
  >([]);

  useEffect(() => {
    // Shuffle and select random images for this gallery
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    const selectedImages = shuffled.slice(0, 8); // Increase to 8 images
    setCurrentImages(selectedImages);

    // Generate random positions for each image
    setPositions(generateRandomPositions(selectedImages.length, side));
  }, [images, side]);

  if (currentImages.length === 0) return null;

  return (
    <div className={`hidden lg:block absolute inset-0 pointer-events-none`}>
      {currentImages.map((image, index) => {
        const position = positions[index];
        if (!position) return null;

        // Choose animation type based on index for variety
        const animationType =
          index % 3 === 0
            ? "gentle-sway"
            : direction === "up"
            ? "float-up"
            : "float-down";

        return (
          <div
            key={`${image}-${index}`}
            className={`absolute overflow-hidden rounded-xl shadow-lg transform transition-all duration-700 hover:scale-110 hover:shadow-2xl pointer-events-auto animate-${animationType}`}
            style={{
              [side === "left" ? "left" : "right"]: `${position.x}%`,
              top: `${position.y}%`,
              width: `${position.size}px`,
              height: `${position.size * 0.8}px`, // Slightly taller aspect ratio
              animationDelay: `${position.delay}s`,
              animationDuration: `${position.duration}s`,
              transform: `rotate(${position.rotation}deg)`,
              opacity: 0.75,
              zIndex: 1,
            }}
          >
            <img
              src={image}
              alt={`Gallery ${index + 1}`}
              className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
              loading="lazy"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-60"></div>

            {/* Subtle border glow effect */}
            <div className="absolute inset-0 rounded-xl border border-white/20"></div>
          </div>
        );
      })}
    </div>
  );
}

export default function About() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Fetch library items (photos from Google Drive)
  const { data: libraryItems } = useQuery<LibraryItem[]>({
    queryKey: ["/api/library"],
  });

  // Fetch published articles (for article images)
  const { data: articles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  // Combine and process images from both sources
  const galleryImages = React.useMemo(() => {
    const images: string[] = [];

    // Add images from library items (Google Drive photos)
    if (libraryItems) {
      libraryItems.forEach((item) => {
        if (item.type === "photo" && item.imageUrls) {
          // Convert Google Drive URLs to direct image URLs
          item.imageUrls.forEach((url, index) => {
            if (
              item.imageSources[index] === "gdrive" &&
              item.gdriveFileIds[index]
            ) {
              // Use Google Drive direct image URL
              const directUrl = `https://drive.google.com/uc?export=view&id=${item.gdriveFileIds[index]}`;
              images.push(directUrl);
            } else {
              images.push(url);
            }
          });
        }
      });
    }

    // Add images from published articles
    if (articles) {
      articles.forEach((article) => {
        if (article.published && article.image) {
          if (article.imageSource === "gdrive" && article.gdriveFileId) {
            // Use Google Drive direct image URL
            const directUrl = `https://drive.google.com/uc?export=view&id=${article.gdriveFileId}`;
            images.push(directUrl);
          } else if (!article.image.includes("default-article-image")) {
            // Only add non-default article images
            images.push(article.image);
          }
        }
      });
    }

    // Shuffle the images array
    return images.sort(() => Math.random() - 0.5);
  }, [libraryItems, articles]);

  return (
    <section id="about" className="py-16 bg-white relative overflow-hidden">
      {/* Animated Galleries */}
      <AnimatedGallery images={galleryImages} direction="up" side="left" />
      <AnimatedGallery images={galleryImages} direction="down" side="right" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12" data-aos="fade-up">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-2 tracking-tight">
            Tentang HIMATIF "Encoder"
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto rounded"></div>
        </div>

        <div
          className="max-w-4xl mx-auto text-justify relative"
          data-aos="fade-up"
          data-aos-delay="200"
        >
          {settings?.aboutUs ? (
            <div className="prose prose-lg lg:prose-xl prose-slate leading-relaxed space-y-4 bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-sm">
              <div dangerouslySetInnerHTML={{ __html: settings.aboutUs }} />
            </div>
          ) : (
            <div className="text-center text-gray-500 bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-sm">
              <p className="mb-4">Informasi tentang himpunan belum tersedia.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
