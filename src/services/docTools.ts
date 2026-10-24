import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { triggerFileDownload } from './imageTools.ts';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker initialization notice:', e);
  }
}

export interface PdfPageImage {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  filename: string;
}

/**
 * Converts multiple image files into a single formatted PDF document
 */
export async function imagesToPdf(
  images: Array<{ file: File; orientation?: 'auto' | 'portrait' | 'landscape' }>,
  options: {
    pageSize?: 'a4' | 'letter' | 'auto';
    margin?: 'none' | 'small' | 'medium';
    title?: string;
  } = {}
): Promise<{ blob: Blob; url: string; pageCount: number }> {
  if (images.length === 0) {
    throw new Error('Please select at least one image to convert to PDF.');
  }

  const pageSize = options.pageSize || 'a4';
  const marginOption = options.margin || 'none';

  // Standard sizes in points (72 points/inch)
  // A4: 595.28 x 841.89 points
  // Letter: 612 x 792 points
  const standardDimensions = {
    a4: { w: 595.28, h: 841.89 },
    letter: { w: 612, h: 792 },
  };

  let pdf: jsPDF | null = null;

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const imgObj = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const objUrl = URL.createObjectURL(item.file);
      el.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve(el);
      };
      el.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error(`Failed to read image: ${item.file.name}`));
      };
      el.src = objUrl;
    });

    const imgW = imgObj.naturalWidth || imgObj.width;
    const imgH = imgObj.naturalHeight || imgObj.height;
    const isLandscape = imgW > imgH;

    let orientation: 'portrait' | 'landscape' = isLandscape ? 'landscape' : 'portrait';
    if (item.orientation && item.orientation !== 'auto') {
      orientation = item.orientation;
    }

    let pageW = standardDimensions.a4.w;
    let pageH = standardDimensions.a4.h;

    if (pageSize === 'letter') {
      pageW = standardDimensions.letter.w;
      pageH = standardDimensions.letter.h;
    } else if (pageSize === 'auto') {
      // Auto fits exact image aspect ratio in points (assume 96 DPI screen = 72 pt)
      pageW = (imgW * 72) / 96;
      pageH = (imgH * 72) / 96;
    }

    if (pageSize !== 'auto' && orientation === 'landscape') {
      const temp = pageW;
      pageW = pageH;
      pageH = temp;
    }

    if (i === 0) {
      pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: pageSize === 'auto' ? [pageW, pageH] : pageSize,
      });
    } else {
      pdf!.addPage(pageSize === 'auto' ? [pageW, pageH] : pageSize, orientation);
    }

    // Margins
    let margin = 0;
    if (marginOption === 'small') margin = 20;
    if (marginOption === 'medium') margin = 36;

    const printableW = pageW - margin * 2;
    const printableH = pageH - margin * 2;

    // Scale image while preserving aspect ratio
    const imgRatio = imgW / imgH;
    const printRatio = printableW / printableH;

    let drawW = printableW;
    let drawH = printableH;

    if (imgRatio > printRatio) {
      drawW = printableW;
      drawH = printableW / imgRatio;
    } else {
      drawH = printableH;
      drawW = printableH * imgRatio;
    }

    const drawX = margin + (printableW - drawW) / 2;
    const drawY = margin + (printableH - drawH) / 2;

    // Convert to canvas dataURL
    const canvas = document.createElement('canvas');
    canvas.width = imgW;
    canvas.height = imgH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(imgObj, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      pdf!.addImage(dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
    }
  }

  if (!pdf) {
    throw new Error('Failed to create PDF');
  }

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    pageCount: images.length,
  };
}

/**
 * Extracts all pages of a PDF document into high-resolution PNG / JPG images
 */
export async function pdfToImages(
  pdfFile: File,
  options: {
    format?: 'png' | 'jpeg';
    scale?: number; // default 2.0 for crisp retina resolution
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<PdfPageImage[]> {
  const format = options.format || 'png';
  const scale = options.scale || 2.0;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const results: PdfPageImage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    // Fill white background for pages
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext as any).promise;

    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), mime, 0.95);
    });

    const baseName = pdfFile.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}_page_${pageNum}.${ext}`;

    results.push({
      pageNumber: pageNum,
      dataUrl: canvas.toDataURL(mime, 0.95),
      blob,
      width: canvas.width,
      height: canvas.height,
      filename,
    });

    if (options.onProgress) {
      options.onProgress(pageNum, numPages);
    }
  }

  return results;
}

/**
 * Merges multiple PDF files into a single unified PDF document
 */
export async function mergePdfFiles(
  pdfFiles: File[],
  options: { outputName?: string } = {}
): Promise<{ blob: Blob; url: string; totalPages: number; filename: string }> {
  if (pdfFiles.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  const mergedPdf = await PDFDocument.create();
  let totalPages = 0;

  for (const file of pdfFiles) {
    const fileBytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(fileBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
    totalPages += copiedPages.length;
  }

  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const filename = options.outputName || 'merged_document.pdf';

  return {
    blob,
    url,
    totalPages,
    filename,
  };
}

/**
 * Converts Plain Text, Markdown, CSV, or Code files into a professionally formatted PDF
 */
export async function textToPdf(
  content: string,
  options: {
    title?: string;
    fontSize?: number;
    fontFamily?: 'courier' | 'helvetica' | 'times';
    pageSize?: 'a4' | 'letter';
    lineSpacing?: number;
  } = {}
): Promise<{ blob: Blob; url: string; pageCount: number }> {
  const title = options.title || 'Document';
  const fontSize = options.fontSize || 10;
  const fontFamily = options.fontFamily || 'helvetica';
  const pageSize = options.pageSize || 'a4';

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: pageSize,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const maxLineWidth = pageWidth - margin * 2;
  const lineHeight = fontSize * (options.lineSpacing || 1.4);

  // Set font
  pdf.setFont(fontFamily);

  // Add Document Header on first page
  let y = margin + 10;

  if (title) {
    pdf.setFontSize(16);
    pdf.setFont(fontFamily, 'bold');
    pdf.text(title, margin, y);
    y += 24;

    pdf.setFontSize(8);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(120, 120, 120);
    const dateStr = `Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    pdf.text(dateStr, margin, y);
    y += 14;

    // Divider line
    pdf.setDrawColor(220, 225, 235);
    pdf.setLineWidth(1);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 20;
  }

  // Content font setup
  pdf.setFont(fontFamily, 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(30, 41, 59);

  // Split lines & word wrap
  const rawLines = content.split(/\r?\n/);
  let currentPage = 1;

  for (const line of rawLines) {
    const wrappedLines = pdf.splitTextToSize(line || ' ', maxLineWidth);

    for (const subLine of wrappedLines) {
      if (y + lineHeight > pageHeight - margin) {
        // Add footer page number
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

        // Next page
        pdf.addPage();
        currentPage++;
        y = margin + 10;

        pdf.setFont(fontFamily, 'normal');
        pdf.setFontSize(fontSize);
        pdf.setTextColor(30, 41, 59);
      }

      pdf.text(subLine, margin, y);
      y += lineHeight;
    }
  }

  // Footer for last page
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    pageCount: currentPage,
  };
}

/**
 * Converts CSV string to JSON array or formatted text
 */
export function csvToJson(csvText: string): string {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return '[]';

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    if (currentLine.length === headers.length) {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = currentLine[index];
      });
      rows.push(obj);
    }
  }

  return JSON.stringify(rows, null, 2);
}

/**
 * Converts JSON string to CSV format
 */
export function jsonToCsv(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return 'Error: JSON must be an array of objects';
    }

    const headers = Array.from(new Set(parsed.flatMap((item) => Object.keys(item))));
    const csvRows = [headers.join(',')];

    for (const item of parsed) {
      const row = headers.map((header) => {
        const val = item[header] !== undefined ? String(item[header]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  } catch (e: any) {
    return `Invalid JSON format: ${e.message}`;
  }
}
