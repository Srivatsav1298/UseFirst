export type DetectedBarcode = {
  rawValue: string;
  format: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  confidence: "high" | "medium";
};

type NativeBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<
    { rawValue: string; format: string; boundingBox?: DOMRectReadOnly }[]
  >;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code", "data_matrix"];

export async function detectBarcodesInImage(image: Blob): Promise<{ barcodes: DetectedBarcode[]; multipleSupported: boolean }> {
  const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (Detector) {
    try {
      const supported = await (Detector as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats?.();
      const formats = supported ? supported.filter((f) => FORMATS.includes(f)) : undefined;
      const detector = new Detector(formats?.length ? { formats } : undefined);
      const bitmap = await createImageBitmap(image);
      const results = await detector.detect(bitmap);
      bitmap.close();
      return {
        barcodes: results.map((result) => ({
          rawValue: result.rawValue,
          format: result.format,
          boundingBox: result.boundingBox
            ? { x: result.boundingBox.x, y: result.boundingBox.y, width: result.boundingBox.width, height: result.boundingBox.height }
            : undefined,
          confidence: "high",
        })),
        multipleSupported: true,
      };
    } catch {
      // fall through to ZXing
    }
  }

  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader();
    const url = URL.createObjectURL(image);
    try {
      const result = await reader.decodeFromImageUrl(url);
      const points = result.getResultPoints();
      const xs = points?.map((p) => p.getX()) ?? [];
      const ys = points?.map((p) => p.getY()) ?? [];
      const bbox =
        xs.length && ys.length
          ? {
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(...xs) - Math.min(...xs),
              height: Math.max(...ys) - Math.min(...ys),
            }
          : undefined;
      return {
        barcodes: [
          {
            rawValue: result.getText(),
            format: String(result.getBarcodeFormat()),
            boundingBox: bbox,
            confidence: "high",
          },
        ],
        multipleSupported: false,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { barcodes: [], multipleSupported: false };
  }
}

export function assignDatesToBarcodes<
  T extends { boundingBox?: { x: number; y: number; width: number; height: number } },
>(
  barcodes: T[],
  lines: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[],
  hasDate: (text: string) => boolean,
): Map<T, string> {
  const map = new Map<T, string>();
  if (!barcodes.length) return map;
  for (const line of lines) {
    if (!hasDate(line.text)) continue;
    let best: T | null = null;
    let bestDistance = Infinity;
    for (const barcode of barcodes) {
      if (!barcode.boundingBox) continue;
      const bx = barcode.boundingBox.x + barcode.boundingBox.width / 2;
      const by = barcode.boundingBox.y + barcode.boundingBox.height / 2;
      const lx = (line.bbox.x0 + line.bbox.x1) / 2;
      const ly = (line.bbox.y0 + line.bbox.y1) / 2;
      const distance = Math.hypot(bx - lx, by - ly);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = barcode;
      }
    }
    if (best && !map.has(best)) map.set(best, line.text);
  }
  return map;
}
