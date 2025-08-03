import React, { useState, useRef, useEffect, useMemo } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  placeholder?: string;
  quality?: number;
  sizes?: string;
  priority?: boolean;
}

// Image cache to prevent duplicate requests
const imageCache = new Map<string, Promise<void>>();

// Preload critical images
const preloadImage = (src: string): Promise<void> => {
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
};

export default function OptimizedImage({
  src,
  alt,
  className = "",
  style = {},
  loading = "lazy",
  onLoad,
  onError,
  placeholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=",
  quality = 80,
  sizes,
  priority = false,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority || loading === "eager");
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Memoize optimized src to prevent recalculation
  const optimizedSrc = useMemo(() => {
    // If it's a Google Drive image, add size parameter for optimization
    if (src.includes("drive.google.com/uc?export=view&id=")) {
      const fileId = src.match(/id=([a-zA-Z0-9-_]+)/)?.[1];
      if (fileId) {
        // Use Google Drive's built-in image resizing with better quality
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
      }
    }

    // For local images, return as-is (could add server-side resizing here)
    return src;
  }, [src]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === "eager") {
      setIsInView(true);
      return;
    }

    // Create observer only once
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        },
        {
          rootMargin: "100px", // Increased for better UX
          threshold: 0.01, // Lower threshold for earlier loading
        }
      );
    }

    if (imgRef.current && observerRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading, priority]);

  // Preload priority images
  useEffect(() => {
    if (priority && optimizedSrc) {
      preloadImage(optimizedSrc);
    }
  }, [priority, optimizedSrc]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(e);
  };

  const combinedStyle: React.CSSProperties = {
    ...style,
    opacity: isLoaded ? 1 : 0,
    transition: "opacity 0.2s ease-out", // Faster transition
  };

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {/* Placeholder - only show when not loaded and no error */}
      {!isLoaded && !hasError && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: isInView ? 0.7 : 1,
            filter: "blur(2px)",
            transition: "opacity 0.2s ease-out",
          }}
          loading="eager"
          decoding="sync"
        />
      )}

      {/* Main image */}
      {isInView && !hasError && (
        <img
          src={optimizedSrc}
          alt={alt}
          className="w-full h-full object-cover"
          style={combinedStyle}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          sizes={sizes}
          // Add fetchpriority for priority images
          {...(priority && { fetchPriority: "high" as any })}
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm border border-gray-200 rounded">
          <div className="text-center">
            <div className="text-2xl mb-2">📷</div>
            <div>Image unavailable</div>
          </div>
        </div>
      )}

      {/* Loading indicator - only show when in view but not loaded */}
      {isInView && !isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}
