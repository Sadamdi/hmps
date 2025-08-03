import sharp from "sharp";
import fs from "fs";
import path from "path";

const ATTACHED_ASSETS_DIR = path.join(process.cwd(), "attached_assets");
const SUPPORTED_FORMATS = [".jpg", ".jpeg", ".png", ".webp"];

interface OptimizationOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: "webp" | "jpeg" | "png";
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  quality: 80,
  maxWidth: 1200,
  maxHeight: 1200,
  format: "webp",
};

async function optimizeImage(
  inputPath: string,
  outputPath: string,
  options: OptimizationOptions
) {
  try {
    const stats = fs.statSync(inputPath);
    const originalSize = stats.size;

    await sharp(inputPath)
      .resize(options.maxWidth, options.maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat(options.format, { quality: options.quality })
      .toFile(outputPath);

    const newStats = fs.statSync(outputPath);
    const newSize = newStats.size;
    const savings = ((originalSize - newSize) / originalSize) * 100;

    console.log(
      `✅ ${path.basename(inputPath)}: ${(originalSize / 1024).toFixed(
        1
      )}KB → ${(newSize / 1024).toFixed(1)}KB (${savings.toFixed(1)}% saved)`
    );

    return { originalSize, newSize, savings };
  } catch (error) {
    console.error(`❌ Failed to optimize ${inputPath}:`, error);
    return null;
  }
}

async function processDirectory(dirPath: string, options: OptimizationOptions) {
  const files = fs.readdirSync(dirPath);
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let processedCount = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      const subResult = await processDirectory(filePath, options);
      totalOriginalSize += subResult.totalOriginalSize;
      totalNewSize += subResult.totalNewSize;
      processedCount += subResult.processedCount;
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        // Create optimized filename
        const name = path.parse(file).name;
        const optimizedName = `${name}.optimized.${options.format}`;
        const optimizedPath = path.join(dirPath, optimizedName);

        // Skip if optimized version already exists and is newer
        if (fs.existsSync(optimizedPath)) {
          const originalStat = fs.statSync(filePath);
          const optimizedStat = fs.statSync(optimizedPath);
          if (optimizedStat.mtime > originalStat.mtime) {
            console.log(`⏭️  Skipping ${file} (already optimized)`);
            continue;
          }
        }

        const result = await optimizeImage(filePath, optimizedPath, options);
        if (result) {
          totalOriginalSize += result.originalSize;
          totalNewSize += result.newSize;
          processedCount++;
        }
      }
    }
  }

  return { totalOriginalSize, totalNewSize, processedCount };
}

async function main() {
  console.log("🖼️  Starting image optimization...\n");

  if (!fs.existsSync(ATTACHED_ASSETS_DIR)) {
    console.error("❌ attached_assets directory not found!");
    process.exit(1);
  }

  const startTime = Date.now();
  const result = await processDirectory(ATTACHED_ASSETS_DIR, DEFAULT_OPTIONS);

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log("\n📊 Optimization Summary:");
  console.log(`   Files processed: ${result.processedCount}`);
  console.log(
    `   Original size: ${(result.totalOriginalSize / 1024 / 1024).toFixed(2)}MB`
  );
  console.log(
    `   Optimized size: ${(result.totalNewSize / 1024 / 1024).toFixed(2)}MB`
  );
  console.log(
    `   Total savings: ${(
      ((result.totalOriginalSize - result.totalNewSize) /
        result.totalOriginalSize) *
      100
    ).toFixed(1)}%`
  );
  console.log(`   Time taken: ${duration.toFixed(1)}s`);

  console.log("\n💡 Next steps:");
  console.log("   1. Update your code to use .optimized.webp files");
  console.log("   2. Set up automatic optimization for new uploads");
  console.log("   3. Consider using a CDN for better performance");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { optimizeImage, processDirectory };
