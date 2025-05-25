export const getCroppedImg = async (
  imageSrc: string,
  crop: { width: number; height: number; x: number; y: number }
): Promise<File | null> => {
  const image = new Image();
  image.crossOrigin = "anonymous"; // penting untuk gambar eksternal
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  // Deteksi format dari imageSrc
  const mimeMatch = imageSrc.match(/^data:(image\/\w+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png"; // default ke PNG
  const fileExtension = mimeType === "image/jpeg" ? "jpg" : "png";

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      resolve(
        new File([blob], `cropped-image.${fileExtension}`, { type: mimeType })
      );
    }, mimeType);
  });
};
