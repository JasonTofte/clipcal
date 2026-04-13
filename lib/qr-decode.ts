// Best-effort QR code decode from an uploaded flyer image.
//
// Strategy:
//   1. Use the native BarcodeDetector API when available (Chrome / Edge /
//      Android — ~70% of traffic, zero bundle cost, OS-quality decoder).
//   2. Fall back to qr-scanner (nimiq) for iOS Safari / Firefox. Dynamic
//      import keeps the ~57 KB cost out of the initial bundle.
//
// Returns the decoded URL or null. URLs are filtered to http(s) only —
// rejecting javascript:/data:/file: which would let a malicious flyer
// inject XSS via the <a href={signupUrl}> we render later.

const HTTP_RX = /^https?:\/\//i;

function isSafeUrl(s: string | null | undefined): s is string {
  if (!s || typeof s !== 'string') return false;
  if (!HTTP_RX.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

type BarcodeDetectorCtor = new (init?: { formats?: string[] }) => {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

async function decodeWithBarcodeDetector(file: File): Promise<string | null> {
  const Ctor = getBarcodeDetector();
  if (!Ctor) return null;
  try {
    const detector = new Ctor({ formats: ['qr_code'] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    bitmap.close?.();
    const value = codes[0]?.rawValue;
    return isSafeUrl(value) ? value : null;
  } catch {
    return null;
  }
}

async function decodeWithQrScanner(file: File): Promise<string | null> {
  try {
    const mod = await import('qr-scanner');
    const QrScanner = mod.default ?? mod;
    // qr-scanner.scanImage returns a string (the raw value) or throws on
    // no-decode. Its returnDetailedScanResult option also exists; we don't
    // need the corner data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (QrScanner as any).scanImage(file)) as string;
    return isSafeUrl(result) ? result : null;
  } catch {
    return null;
  }
}

export async function decodeQRFromFile(file: File): Promise<string | null> {
  const native = await decodeWithBarcodeDetector(file);
  if (native) return native;
  return decodeWithQrScanner(file);
}

// Exported for unit tests. Don't use directly in product code.
export const __test__ = { isSafeUrl };
