import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FilePlus,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Archive,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  FileCode,
  FileImage,
  Combine,
  Split,
  Eye,
} from 'lucide-react';
import {
  imagesToPdf,
  pdfToImages,
  mergePdfFiles,
  textToPdf,
  csvToJson,
  jsonToCsv,
  PdfPageImage,
} from '../../services/docTools.ts';
import { downloadFilesAsZip, triggerFileDownload, formatBytes } from '../../services/imageTools.ts';

type DocToolTab = 'images-to-pdf' | 'pdf-to-images' | 'pdf-merge' | 'text-to-pdf' | 'csv-json';

export const DocumentConverter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DocToolTab>('images-to-pdf');

  // --- Sub-Tool 1: Images to PDF state ---
  const [imgPdfFiles, setImgPdfFiles] = useState<Array<{ id: string; file: File; preview: string }>>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'auto'>('a4');
  const [pageMargin, setPageMargin] = useState<'none' | 'small' | 'medium'>('small');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<{ blob: Blob; url: string; pageCount: number } | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // --- Sub-Tool 2: PDF to Images state ---
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedPages, setExtractedPages] = useState<PdfPageImage[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractFormat, setExtractFormat] = useState<'png' | 'jpeg'>('png');
  const [isZippingPages, setIsZippingPages] = useState<boolean>(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // --- Sub-Tool 3: PDF Merger state ---
  const [mergeFiles, setMergeFiles] = useState<Array<{ id: string; file: File }>>([]);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergedPdfResult, setMergedPdfResult] = useState<{ blob: Blob; url: string; totalPages: number } | null>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  // --- Sub-Tool 4: Text/Doc to PDF state ---
  const [textContent, setTextContent] = useState<string>(
    '# Project Proposal & Document Report\n\nThis document was generated using the Client-Side Document Conversion Suite.\n\n## Overview\n- Fast, private and client-side processing\n- Zero server storage required\n- Instant high-fidelity PDF output\n\n### Summary\nAll files are converted in high resolution with automatic pagination, custom title headers, and page numbers.'
  );
  const [docTitle, setDocTitle] = useState<string>('Document Report');
  const [fontSize, setFontSize] = useState<number>(10);
  const [isConvertingTextPdf, setIsConvertingTextPdf] = useState<boolean>(false);
  const [textPdfResult, setTextPdfResult] = useState<{ blob: Blob; url: string; pageCount: number } | null>(null);

  // --- Sub-Tool 5: CSV & JSON converter state ---
  const [csvInput, setCsvInput] = useState<string>(
    'Name,Email,Role,Country\nJohn Doe,john@example.com,Software Engineer,India\nJane Smith,jane@example.com,Product Designer,USA\nAlex Wong,alex@example.com,Data Scientist,Singapore'
  );
  const [convertedJson, setConvertedJson] = useState<string>('');

  // Handlers for Images to PDF
  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    const newItems: Array<{ id: string; file: File; preview: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newItems.push({
          id: `${Date.now()}-${i}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }
    setImgPdfFiles((prev) => [...prev, ...newItems]);
    setPdfResult(null);
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= imgPdfFiles.length) return;
    const copy = [...imgPdfFiles];
    const item = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = item;
    setImgPdfFiles(copy);
    setPdfResult(null);
  };

  const generateImagesPdf = async () => {
    if (imgPdfFiles.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const result = await imagesToPdf(
        imgPdfFiles.map((item) => ({ file: item.file })),
        { pageSize, margin: pageMargin }
      );
      setPdfResult(result);
    } catch (err: any) {
      alert(`Error generating PDF: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handlers for PDF to Images
  const handlePdfUpload = async (file: File) => {
    setPdfFile(file);
    setExtractedPages([]);
    setIsExtracting(true);
    try {
      const pages = await pdfToImages(file, { format: extractFormat, scale: 2.0 });
      setExtractedPages(pages);
    } catch (err: any) {
      alert(`Failed to extract pages from PDF: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const downloadAllPagesZip = async () => {
    if (extractedPages.length === 0) return;
    setIsZippingPages(true);
    try {
      await downloadFilesAsZip(
        extractedPages.map((p) => ({ filename: p.filename, blob: p.blob })),
        `${pdfFile?.name.replace(/\.[^/.]+$/, '')}_pages.zip`
      );
    } finally {
      setIsZippingPages(false);
    }
  };

  // Handlers for PDF Merger
  const handleMergeFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: Array<{ id: string; file: File }> = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === 'application/pdf' || files[i].name.toLowerCase().endsWith('.pdf')) {
        newItems.push({
          id: `${Date.now()}-${i}`,
          file: files[i],
        });
      }
    }
    setMergeFiles((prev) => [...prev, ...newItems]);
    setMergedPdfResult(null);
  };

  const executeMerge = async () => {
    if (mergeFiles.length < 2) return;
    setIsMerging(true);
    try {
      const result = await mergePdfFiles(mergeFiles.map((m) => m.file));
      setMergedPdfResult(result);
    } catch (err: any) {
      alert(`Merge error: ${err.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Handlers for Text to PDF
  const executeTextToPdf = async () => {
    if (!textContent.trim()) return;
    setIsConvertingTextPdf(true);
    try {
      const result = await textToPdf(textContent, { title: docTitle, fontSize });
      setTextPdfResult(result);
    } catch (err: any) {
      alert(`Text to PDF error: ${err.message}`);
    } finally {
      setIsConvertingTextPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-cyan-950/60 border border-blue-900/50 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Document Conversion Suite
              </span>
              <span className="text-xs text-slate-400">100% Free & Unlimited</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              All-In-One Document & PDF Converter
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Convert Images to PDF, extract PDF pages to high-resolution PNG/JPG, merge multiple PDF documents, and transform TXT, Markdown, CSV, and JSON seamlessly.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('images-to-pdf')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'images-to-pdf'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            <FileImage className="w-4 h-4 text-blue-300" />
            <span>Images to PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('pdf-to-images')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pdf-to-images'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            <Split className="w-4 h-4 text-cyan-300" />
            <span>PDF to Images (PNG/JPG)</span>
          </button>

          <button
            onClick={() => setActiveTab('pdf-merge')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pdf-merge'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            <Combine className="w-4 h-4 text-emerald-300" />
            <span>Merge PDF Files</span>
          </button>

          <button
            onClick={() => setActiveTab('text-to-pdf')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'text-to-pdf'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            <FileCode className="w-4 h-4 text-amber-300" />
            <span>Text / MD to PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('csv-json')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'csv-json'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-300" />
            <span>CSV ⇄ JSON Tool</span>
          </button>
        </div>
      </div>

      {/* --- TAB 1: IMAGES TO PDF --- */}
      {activeTab === 'images-to-pdf' && (
        <div className="space-y-6">
          <div
            onClick={() => imgInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500/80 bg-slate-900/40 hover:bg-blue-950/20 rounded-2xl p-8 sm:p-10 transition-all text-center cursor-pointer overflow-hidden shadow-inner"
          >
            <input
              ref={imgInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
                <FilePlus className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-base font-semibold text-white">
                Select or drop multiple images to merge into a single PDF
              </p>
              <p className="text-xs text-slate-400">JPG, PNG, WEBP, BMP. Re-order pages as needed.</p>
            </div>
          </div>

          {imgPdfFiles.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{imgPdfFiles.length} Pages selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Format:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(e.target.value as any);
                        setPdfResult(null);
                      }}
                      className="bg-transparent font-semibold text-blue-300 focus:outline-none cursor-pointer"
                    >
                      <option value="a4" className="bg-slate-900">A4 Document</option>
                      <option value="letter" className="bg-slate-900">US Letter</option>
                      <option value="auto" className="bg-slate-900">Auto (Fit to Image)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Margin:</span>
                    <select
                      value={pageMargin}
                      onChange={(e) => {
                        setPageMargin(e.target.value as any);
                        setPdfResult(null);
                      }}
                      className="bg-transparent font-semibold text-blue-300 focus:outline-none cursor-pointer"
                    >
                      <option value="none" className="bg-slate-900">None (Full Bleed)</option>
                      <option value="small" className="bg-slate-900">Small (Clean)</option>
                      <option value="medium" className="bg-slate-900">Medium (Standard)</option>
                    </select>
                  </div>

                  <button
                    onClick={generateImagesPdf}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingPdf ? 'Compiling PDF...' : 'Create PDF'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setImgPdfFiles([]);
                      setPdfResult(null);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer"
                    title="Clear list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid of uploaded images */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                {imgPdfFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-2 flex flex-col items-center gap-2"
                  >
                    <div className="w-full h-28 bg-slate-900 rounded-lg overflow-hidden relative">
                      <img src={item.preview} alt="Page" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded font-bold">
                        P{idx + 1}
                      </div>
                    </div>
                    <div className="w-full flex items-center justify-between text-xs px-1">
                      <div className="flex gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveImage(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          title="Move Left/Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === imgPdfFiles.length - 1}
                          onClick={() => moveImage(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          title="Move Right/Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setImgPdfFiles((prev) => prev.filter((_, i) => i !== idx));
                          setPdfResult(null);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Generated Result Card */}
              {pdfResult && (
                <div className="mt-4 p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">PDF Ready for Download</div>
                      <div className="text-xs text-slate-300">
                        {pdfResult.pageCount} Pages • {formatBytes(pdfResult.blob.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerFileDownload(pdfResult.blob, `document_${Date.now()}.pdf`)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Document</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: PDF TO IMAGES --- */}
      {activeTab === 'pdf-to-images' && (
        <div className="space-y-6">
          <div
            onClick={() => pdfInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-cyan-500/80 bg-slate-900/40 hover:bg-cyan-950/20 rounded-2xl p-8 sm:p-10 transition-all text-center cursor-pointer overflow-hidden shadow-inner"
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handlePdfUpload(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Split className="w-7 h-7 text-cyan-400" />
              </div>
              <p className="text-base font-semibold text-white">
                Upload any PDF file to extract all pages as high-resolution PNG or JPG images
              </p>
              <p className="text-xs text-slate-400">Renders crisp retina 2x quality per page.</p>
            </div>
          </div>

          {isExtracting && (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-white">Rendering and extracting PDF pages...</p>
            </div>
          )}

          {extractedPages.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  Extracted {extractedPages.length} Pages from <span className="text-cyan-300">{pdfFile?.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadAllPagesZip}
                    disabled={isZippingPages}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{isZippingPages ? 'Zipping...' : 'Download All Pages (.ZIP)'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {extractedPages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-3 space-y-2 flex flex-col justify-between"
                  >
                    <div className="w-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center p-2 min-h-[160px]">
                      <img
                        src={page.dataUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="max-h-48 object-contain rounded shadow"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-mono text-slate-300 font-semibold">Page {page.pageNumber}</span>
                      <span className="text-slate-500 text-[11px] font-mono">{formatBytes(page.blob.size)}</span>
                      <button
                        onClick={() => triggerFileDownload(page.blob, page.filename)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: PDF MERGER --- */}
      {activeTab === 'pdf-merge' && (
        <div className="space-y-6">
          <div
            onClick={() => mergeInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-emerald-500/80 bg-slate-900/40 hover:bg-emerald-950/20 rounded-2xl p-8 sm:p-10 transition-all text-center cursor-pointer overflow-hidden shadow-inner"
          >
            <input
              ref={mergeInputRef}
              type="file"
              multiple
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleMergeFiles(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Combine className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-base font-semibold text-white">Select multiple PDF documents to merge into one</p>
              <p className="text-xs text-slate-400">Drag to order documents, combine chapters and invoices.</p>
            </div>
          </div>

          {mergeFiles.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{mergeFiles.length} PDF files queued</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={executeMerge}
                    disabled={isMerging || mergeFiles.length < 2}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isMerging ? 'animate-spin' : ''}`} />
                    <span>{isMerging ? 'Merging Documents...' : 'Merge PDFs'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMergeFiles([]);
                      setMergedPdfResult(null);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {mergeFiles.map((m, idx) => (
                  <div
                    key={m.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div className="text-sm font-medium text-white truncate max-w-sm sm:max-w-md">
                        {m.file.name}
                      </div>
                      <span className="text-xs text-slate-400 font-mono">({formatBytes(m.file.size)})</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const copy = [...mergeFiles];
                          const t = copy[idx];
                          copy[idx] = copy[idx - 1];
                          copy[idx - 1] = t;
                          setMergeFiles(copy);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        disabled={idx === mergeFiles.length - 1}
                        onClick={() => {
                          const copy = [...mergeFiles];
                          const t = copy[idx];
                          copy[idx] = copy[idx + 1];
                          copy[idx + 1] = t;
                          setMergeFiles(copy);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMergeFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {mergedPdfResult && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div>
                      <div className="text-sm font-semibold text-white">Merged Successfully!</div>
                      <div className="text-xs text-slate-300">
                        Total {mergedPdfResult.totalPages} pages • {formatBytes(mergedPdfResult.blob.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerFileDownload(mergedPdfResult.blob, 'merged_document.pdf')}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Merged PDF</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: TEXT / MARKDOWN TO PDF --- */}
      {activeTab === 'text-to-pdf' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Document Title Header:</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document Title"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Font Size (Points):</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={9}>Small (9pt - Dense)</option>
                <option value={10}>Standard (10pt)</option>
                <option value={12}>Large (12pt - Accessible)</option>
                <option value={14}>Extra Large (14pt)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Text / Markdown Content:</label>
              <span className="text-[11px] text-slate-500">{textContent.length} characters</span>
            </div>
            <textarea
              rows={8}
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value);
                setTextPdfResult(null);
              }}
              placeholder="Paste text, Markdown notes, reports, or lists here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 leading-relaxed resize-y"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">
              Generates formatted PDF with auto word wrap, clean pagination, and headers.
            </div>

            <button
              onClick={executeTextToPdf}
              disabled={isConvertingTextPdf || !textContent.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConvertingTextPdf ? 'animate-spin' : ''}`} />
              <span>{isConvertingTextPdf ? 'Creating PDF...' : 'Convert to PDF'}</span>
            </button>
          </div>

          {textPdfResult && (
            <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-white">Text Converted to PDF</div>
                  <div className="text-xs text-slate-300">
                    {textPdfResult.pageCount} Pages • {formatBytes(textPdfResult.blob.size)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => triggerFileDownload(textPdfResult.blob, `${docTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Document</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 5: CSV & JSON TOOLS --- */}
      {activeTab === 'csv-json' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                CSV ⇄ JSON Document Converter
              </h3>
              <p className="text-xs text-slate-400">Convert spreadsheet CSV data to JSON array or vice versa.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Side */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">CSV Data:</span>
                <button
                  onClick={() => {
                    const json = csvToJson(csvInput);
                    setConvertedJson(json);
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow"
                >
                  Convert CSV to JSON →
                </button>
              </div>
              <textarea
                rows={10}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="Paste CSV data here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500 leading-relaxed resize-y"
              />
            </div>

            {/* Output Side */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">JSON Data:</span>
                <button
                  onClick={() => {
                    const csv = jsonToCsv(convertedJson || csvInput);
                    setCsvInput(csv);
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  ← Convert JSON to CSV
                </button>
              </div>
              <textarea
                rows={10}
                value={convertedJson}
                onChange={(e) => setConvertedJson(e.target.value)}
                placeholder="Converted JSON will appear here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500 leading-relaxed resize-y"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {convertedJson && (
              <button
                onClick={() => {
                  const blob = new Blob([convertedJson], { type: 'application/json' });
                  triggerFileDownload(blob, 'data.json');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON File</span>
              </button>
            )}

            {csvInput && (
              <button
                onClick={() => {
                  const blob = new Blob([csvInput], { type: 'text/csv' });
                  triggerFileDownload(blob, 'data.csv');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV File</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
