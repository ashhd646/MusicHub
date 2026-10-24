import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

export interface ImageConversionItem {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  originalSize: number;
  originalFormat: string;
  originalWidth: number;
  originalHeight: number;
  targetFormat: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  resultBlob?: Blob;
  resultUrl?: string;
  resultSize?: number;
  errorMessage?: string;
}

export const SUPPORTED_INPUT_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/x-icon',
  'image/avif',
  'image/tiff',
];

export const OUTPUT_FORMATS = [
  { value: 'png', label: 'PNG (Lossless & Transparent)', mime: 'image/png', ext: '.png' },
  { value: 'jpg', label: 'JPG / JPEG (Universal & Lightweight)', mime: 'image/jpeg', ext: '.jpg' },
  { value: 'webp', label: 'WEBP (Modern Web Standard)', mime: 'image/webp', ext: '.webp' },
  { value: 'ico', label: 'ICO (Favicon & Windows Icon)', mime: 'image/x-icon', ext: '.ico' },
  { value: 'bmp', label: 'BMP (Bitmap)', mime: 'image/bmp', ext: '.bmp' },
  { value: 'pdf', label: 'PDF (Print & Document)', mime: 'application/pdf', ext: '.pdf' },
  { value: 'gif', label: 'GIF (Single Frame / Graphic)', mime: 'image/gif', ext: '.gif' },
  { value: 'svg', label: 'SVG (Vector Wrapped)', mime: 'image/svg+xml', ext: '.svg' },
];

/**
 * Reads an image file and determines its dimensions
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, previewUrl: url });
    };
    img.onerror = () => {
      // If SVG or fallback
      resolve({ width: 800, height: 600, previewUrl: url });
    };
    img.src = url;
  });
}

/**
 * Encodes canvas ImageData into BMP format array buffer
 */
function canvasToBmpBlob(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for BMP conversion');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BMP Header
  view.setUint16(0, 0x424d, false); // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true); // offset to pixel data

  // DIB Header (BITMAPINFOHEADER)
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // bottom-to-top
  view.setUint16(26, 1, true); // color planes
  view.setUint16(28, 24, true); // 24 bits per pixel
  view.setUint32(30, 0, true); // no compression (BI_RGB)
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // 72 DPI
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  // Write BGR pixels (bottom-up)
  let offset = 54;
  const data = imgData.data;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      view.setUint8(offset++, b);
      view.setUint8(offset++, g);
      view.setUint8(offset++, r);
    }
    // Row padding to 4-byte boundary
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Encodes canvas to standard Windows ICO format (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
 */
async function canvasToIcoBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  // Common favicon sizes
  const targetSize = Math.min(256, Math.max(16, canvas.width > canvas.height ? canvas.width : canvas.height));
  const icoCanvas = document.createElement('canvas');
  icoCanvas.width = targetSize > 128 ? 128 : targetSize > 64 ? 64 : targetSize > 32 ? 32 : 16;
  icoCanvas.height = icoCanvas.width;
  const ctx = icoCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, 0, 0, icoCanvas.width, icoCanvas.height);
  }

  const pngBlob = await new Promise<Blob>((resolve) => {
    icoCanvas.toBlob((blob) => resolve(blob || new Blob()), 'image/png');
  });

  const pngBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngBuffer);

  // ICO header: 6 bytes + 1 directory entry: 16 bytes + PNG data
  const totalSize = 6 + 16 + pngBytes.length;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // ICONDIR header
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // 1 = ICO
  view.setUint16(4, 1, true); // 1 image

  // ICONDIRENTRY
  view.setUint8(6, icoCanvas.width >= 256 ? 0 : icoCanvas.width);
  view.setUint8(7, icoCanvas.height >= 256 ? 0 : icoCanvas.height);
  view.setUint8(8, 0); // palette
  view.setUint8(9, 0); // reserved
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bit count
  view.setUint32(14, pngBytes.length, true); // image size
  view.setUint32(18, 22, true); // data offset (6 + 16 = 22)

  // Copy PNG bytes
  const uint8 = new Uint8Array(buffer);
  uint8.set(pngBytes, 22);

  return new Blob([buffer], { type: 'image/x-icon' });
}

/**
 * Creates an SVG file containing the image
 */
function canvasToSvgBlob(canvas: HTMLCanvasElement): Blob {
  const dataUrl = canvas.toDataURL('image/png');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}" href="${dataUrl}" />
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/**
 * Converts image file to PDF
 */
async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const isLandscape = canvas.width > canvas.height;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

/**
 * Universal Image Converter Core Function
 */
export async function convertImage(
  file: File,
  targetFormat: string,
  options: {
    quality?: number; // 0.1 to 1.0
    maxWidth?: number;
    maxHeight?: number;
    backgroundColor?: string; // e.g. '#ffffff' for JPEG conversion when source has transparency
  } = {}
): Promise<{ blob: Blob; url: string; size: number; width: number; height: number; filename: string }> {
  const quality = options.quality ?? 0.92;

  // Load image into HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const objUrl = URL.createObjectURL(file);
    el.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error(`Could not load image: ${file.name}`));
    };
    el.src = objUrl;
  });

  let originalW = img.naturalWidth || img.width;
  let originalH = img.naturalHeight || img.height;

  // Calculate resized dimensions if specified
  let targetW = originalW;
  let targetH = originalH;

  if (options.maxWidth && targetW > options.maxWidth) {
    const ratio = options.maxWidth / targetW;
    targetW = Math.round(targetW * ratio);
    targetH = Math.round(targetH * ratio);
  }

  if (options.maxHeight && targetH > options.maxHeight) {
    const ratio = options.maxHeight / targetH;
    targetW = Math.round(targetW * ratio);
    targetH = Math.round(targetH * ratio);
  }

  // Draw onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D rendering context');

  // Fill white background for JPEG / BMP if needed
  if (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'bmp') {
    ctx.fillStyle = options.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw image with smooth scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let resultBlob: Blob;

  switch (targetFormat.toLowerCase()) {
    case 'jpg':
    case 'jpeg': {
      resultBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
      });
      break;
    }
    case 'png': {
      resultBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
      });
      break;
    }
    case 'webp': {
      resultBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/webp', quality);
      });
      break;
    }
    case 'bmp': {
      resultBlob = canvasToBmpBlob(canvas);
      break;
    }
    case 'ico': {
      resultBlob = await canvasToIcoBlob(canvas);
      break;
    }
    case 'svg': {
      resultBlob = canvasToSvgBlob(canvas);
      break;
    }
    case 'pdf': {
      resultBlob = await canvasToPdfBlob(canvas);
      break;
    }
    case 'gif': {
      resultBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/gif');
      });
      break;
    }
    default: {
      resultBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
      });
      break;
    }
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const ext = targetFormat.toLowerCase() === 'jpeg' ? 'jpg' : targetFormat.toLowerCase();
  const filename = `${baseName}.${ext}`;
  const url = URL.createObjectURL(resultBlob);

  return {
    blob: resultBlob,
    url,
    size: resultBlob.size,
    width: canvas.width,
    height: canvas.height,
    filename,
  };
}

/**
 * Image Compressor
 */
export async function compressImage(
  file: File,
  options: {
    quality: number; // 0.1 to 1.0 (e.g. 0.75 for 75%)
    scalePercent?: number; // 10 to 100
    maxWidth?: number;
    format?: 'keep' | 'webp' | 'jpeg' | 'png';
  }
): Promise<{
  blob: Blob;
  url: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  width: number;
  height: number;
  filename: string;
}> {
  const originalSize = file.size;
  const quality = Math.min(1.0, Math.max(0.05, options.quality));

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const objUrl = URL.createObjectURL(file);
    el.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error(`Failed to load image for compression: ${file.name}`));
    };
    el.src = objUrl;
  });

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  // Apply scale
  if (options.scalePercent && options.scalePercent < 100) {
    const factor = options.scalePercent / 100;
    w = Math.round(w * factor);
    h = Math.round(h * factor);
  }

  if (options.maxWidth && w > options.maxWidth) {
    const factor = options.maxWidth / w;
    w = Math.round(w * factor);
    h = Math.round(h * factor);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  let targetMime = file.type || 'image/jpeg';
  if (options.format && options.format !== 'keep') {
    if (options.format === 'webp') targetMime = 'image/webp';
    if (options.format === 'jpeg') targetMime = 'image/jpeg';
    if (options.format === 'png') targetMime = 'image/png';
  }

  // If compressing to JPEG, give canvas a white background in case of transparent alpha
  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const compressedBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), targetMime, quality);
  });

  const compressedSize = compressedBlob.size;
  const savedBytes = Math.max(0, originalSize - compressedSize);
  const savedPercent = originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  let ext = targetMime === 'image/webp' ? 'webp' : targetMime === 'image/jpeg' ? 'jpg' : 'png';
  const filename = `${baseName}_compressed.${ext}`;
  const url = URL.createObjectURL(compressedBlob);

  return {
    blob: compressedBlob,
    url,
    originalSize,
    compressedSize,
    savedBytes,
    savedPercent,
    width: canvas.width,
    height: canvas.height,
    filename,
  };
}

/**
 * Downloads multiple files packaged into a single clean ZIP archive
 */
export async function downloadFilesAsZip(
  files: Array<{ filename: string; blob: Blob }>,
  zipName: string = 'converted_files.zip'
): Promise<void> {
  const zip = new JSZip();
  files.forEach((item) => {
    zip.file(item.filename, item.blob);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(content, zipName);
}

/**
 * Helper to trigger file download in browser
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Format bytes into human readable format (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
