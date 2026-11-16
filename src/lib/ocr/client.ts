export type OcrLine = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
export type OcrResult = {
  text: string;
  confidence: number;
  lines: OcrLine[];
};

type TesseractWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
type TesseractLine = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number }; words?: TesseractWord[] };

export async function recogniseText(
  image: string | Blob,
  options: { language?: string; onProgress?: (progress: number) => void } = {},
): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(options.language || "eng", 1, {
    logger: (message) => {
      if (typeof message.progress === "number") options.onProgress?.(message.progress);
    },
  });
  try {
    const result = await worker.recognize(image);
    const data = result.data as unknown as {
      text?: string;
      confidence?: number;
      blocks?: { paragraphs?: { lines?: TesseractLine[] }[] }[];
    };
    const lines: OcrLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          if (line.text?.trim()) {
            lines.push({ text: line.text.trim(), confidence: line.confidence, bbox: line.bbox });
          }
        }
      }
    }
    return {
      text: data.text ?? "",
      confidence: data.confidence ?? 0,
      lines,
    };
  } finally {
    await worker.terminate();
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<Blob> {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });
}
