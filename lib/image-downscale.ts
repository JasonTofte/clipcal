// Client-side downscale before upload. Phone photos are routinely 8-12MB,
// which trips Vercel's ~4.5MB serverless body limit (HTTP 413) before our
// own 5MB check. Re-encoding to JPEG at a max long-edge of 2000px brings
// typical flyers to <1MB without visible quality loss for OCR.

const MAX_DIMENSION = 2000;
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

export async function downscaleIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= TARGET_MAX_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longEdge = Math.max(width, height);
    const scale = longEdge > MAX_DIMENSION ? MAX_DIMENSION / longEdge : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
