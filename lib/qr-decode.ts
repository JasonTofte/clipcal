import jsQR from 'jsqr';

/**
 * Attempts to decode a QR code from an image file.
 * Returns the decoded string if a QR code is found and contains a URL, otherwise null.
 */
export async function decodeQRFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(objectUrl);

      const decoded = result?.data ?? null;
      // Only return it if it looks like a URL
      if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) {
        resolve(decoded);
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}
