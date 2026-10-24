import React, { useState, useRef } from 'react';
import {
  Upload,
  ArrowRight,
  Download,
  Trash2,
  CheckCircle2,
  RefreshCw,
  FileImage,
  Sliders,
  Archive,
  Sparkles,
  Layers,
  Info,
  Check,
} from 'lucide-react';
import {
  OUTPUT_FORMATS,
  convertImage,
  downloadFilesAsZip,
  triggerFileDownload,
  formatBytes,
  getImageDimensions,
  ImageConversionItem,
} from '../../services/imageTools.ts';

const QUICK_ACTIONS = [
  { label: 'PNG to JPG', target: 'jpg', desc: 'Fast & lightweight photos' },
  { label: 'JPG to WEBP', target: 'webp', desc: 'Modern high compression' },
  { label: 'WEBP to PNG', target: 'png', desc: 'Lossless transparency' },
  { label: 'Any to ICO', target: 'ico', desc: 'Web & App favicon' },
  { label: 'Image to PDF', target: 'pdf', desc: 'Printable document' },
  { label: 'Any to BMP', target: 'bmp', desc: 'Raw bitmap' },
];

export const ImageConverter: React.FC = () => {
  const [items, setItems] = useState<ImageConversionItem[]>([]);
  const [globalTargetFormat, setGlobalTargetFormat] = useState<string>('webp');
  const [quality, setQuality] = useState<number>(0.92);
  const [isConvertingAll, setIsConvertingAll] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: ImageConversionItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpg|jpeg|webp|gif|bmp|ico|svg|avif|tiff)$/i)) {
        continue;
      }

      const id = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;
      const { width, height, previewUrl } = await getImageDimensions(file);
      const extMatch = file.name.match(/\.([^.]+)$/);
      const originalFormat = extMatch ? extMatch[1].toUpperCase() : 'IMG';

      newItems.push({
        id,
        file,
        previewUrl,
        originalName: file.name,
        originalSize: file.size,
        originalFormat,
        originalWidth: width,
        originalHeight: height,
        targetFormat: globalTargetFormat,
        status: 'idle',
        progress: 0,
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const updateItemTarget = (id: string, targetFormat: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, targetFormat, status: 'idle', resultBlob: undefined } : item))
    );
  };

  const setAllTargetFormats = (format: string) => {
    setGlobalTargetFormat(format);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        targetFormat: format,
        status: item.status === 'done' ? item.status : 'idle',
      }))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setItems([]);
  };

  const convertSingle = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'processing', progress: 50, errorMessage: undefined } : i))
    );

    try {
      const result = await convertImage(item.file, item.targetFormat, { quality });
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'done',
                progress: 100,
                resultBlob: result.blob,
                resultUrl: result.url,
                resultSize: result.size,
              }
            : i
        )
      );
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'error',
                errorMessage: err.message || 'Conversion failed',
              }
            : i
        )
      );
    }
  };

  const convertAll = async () => {
    if (items.length === 0) return;
    setIsConvertingAll(true);

    for (const item of items) {
      if (item.status !== 'done') {
        await convertSingle(item.id);
      }
    }

    setIsConvertingAll(false);
  };

  const downloadAllZip = async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBlob);
    if (doneItems.length === 0) return;

    setIsZipping(true);
    try {
      const filesToZip = doneItems.map((item) => {
        const baseName = item.originalName.replace(/\.[^/.]+$/, '');
        const ext = item.targetFormat.toLowerCase() === 'jpeg' ? 'jpg' : item.targetFormat.toLowerCase();
        return {
          filename: `${baseName}.${ext}`,
          blob: item.resultBlob!,
        };
      });

      await downloadFilesAsZip(filesToZip, `converted_images_${Date.now()}.zip`);
    } catch (e) {
      console.error('Failed to create ZIP', e);
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-purple-950/60 border border-indigo-900/50 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Universal Format Converter
              </span>
              <span className="text-xs text-slate-400">100% Client-Side & Private</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileImage className="w-6 h-6 text-indigo-400" />
              Convert Any Image Extension to Another & Vice Versa
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Convert between <span className="text-indigo-300 font-semibold">JPG, PNG, WEBP, ICO, BMP, PDF, GIF, SVG</span> instantly. Fast batch conversion with zero file size limits, completely inside your browser without uploading to any third-party server.
            </p>
          </div>

          {/* Quick Stats or Badge */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2 text-center">
              <div className="text-xs text-slate-400 font-medium">Supported Formats</div>
              <div className="text-lg font-bold text-indigo-300 font-mono">8+ Extensions</div>
            </div>
          </div>
        </div>

        {/* Quick Format Presets */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Popular 1-Click Conversions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => setAllTargetFormats(action.target)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  globalTargetFormat === action.target
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span>{action.label}</span>
                {globalTargetFormat === action.target && <Check className="w-3 h-3 text-indigo-200" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="group relative border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-900/40 hover:bg-indigo-950/20 rounded-2xl p-8 sm:p-10 transition-all text-center cursor-pointer overflow-hidden shadow-inner"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.ico,.svg,.avif,.tiff"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-indigo-500/10">
            <Upload className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="space-y-1">
            <p className="text-base sm:text-lg font-semibold text-white">
              Drop your images here, or <span className="text-indigo-400 underline underline-offset-4">browse files</span>
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              Supports PNG, JPG, JPEG, WEBP, GIF, BMP, ICO, SVG, AVIF. Multiple files supported.
            </p>
          </div>
        </div>
      </div>

      {/* Active File Management Toolbar */}
      {items.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                Queue: {items.length} {items.length === 1 ? 'file' : 'files'}
              </span>
              {completedCount > 0 && (
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {completedCount}/{items.length} Ready
                </span>
              )}
            </div>

            {/* Batch Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Batch Format Selector */}
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
                <span className="text-xs text-slate-400">Convert all to:</span>
                <select
                  value={globalTargetFormat}
                  onChange={(e) => setAllTargetFormats(e.target.value)}
                  className="bg-transparent text-xs font-bold text-indigo-300 focus:outline-none cursor-pointer"
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value} className="bg-slate-900 text-white">
                      {fmt.ext.toUpperCase()} — {fmt.label.split('(')[0].trim()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quality Slider for lossy formats */}
              {(globalTargetFormat === 'jpg' || globalTargetFormat === 'webp') && (
                <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400">Quality:</span>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={Math.round(quality * 100)}
                    onChange={(e) => setQuality(Number(e.target.value) / 100)}
                    className="w-16 h-1.5 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-indigo-300">{Math.round(quality * 100)}%</span>
                </div>
              )}

              {/* Convert All Button */}
              <button
                onClick={convertAll}
                disabled={isConvertingAll || items.every((i) => i.status === 'done')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConvertingAll ? 'animate-spin' : ''}`} />
                <span>{isConvertingAll ? 'Converting...' : 'Convert All'}</span>
              </button>

              {/* Download All as ZIP */}
              {completedCount > 1 && (
                <button
                  onClick={downloadAllZip}
                  disabled={isZipping}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 transition-all cursor-pointer shadow"
                >
                  <Archive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isZipping ? 'Zipping...' : 'Download ZIP'}</span>
                </button>
              )}

              {/* Clear All */}
              <button
                onClick={clearAll}
                className="p-2 text-slate-400 hover:text-rose-400 bg-slate-950/60 hover:bg-rose-950/30 border border-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Clear all files"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Files List Table */}
          <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
              >
                {/* File Info & Thumbnail */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                    <img
                      src={item.previewUrl}
                      alt={item.originalName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-medium text-white truncate max-w-xs sm:max-w-md">
                      {item.originalName}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/50">
                        {item.originalFormat}
                      </span>
                      <span>•</span>
                      <span>{formatBytes(item.originalSize)}</span>
                      <span>•</span>
                      <span>{item.originalWidth}×{item.originalHeight}px</span>
                    </div>
                  </div>
                </div>

                {/* Target Format & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                    <select
                      value={item.targetFormat}
                      onChange={(e) => updateItemTarget(item.id, e.target.value)}
                      disabled={item.status === 'processing'}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {OUTPUT_FORMATS.map((fmt) => (
                        <option key={fmt.value} value={fmt.value}>
                          {fmt.ext.toUpperCase()} ({fmt.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status / Download / Action */}
                  <div className="flex items-center gap-2">
                    {item.status === 'idle' && (
                      <button
                        onClick={() => convertSingle(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
                      >
                        Convert
                      </button>
                    )}

                    {item.status === 'processing' && (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-950/50 border border-indigo-800/50 px-2.5 py-1 rounded-lg">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Converting...</span>
                      </div>
                    )}

                    {item.status === 'done' && item.resultBlob && (
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50 hidden md:block">
                          {formatBytes(item.resultSize || 0)}
                        </div>
                        <button
                          onClick={() => {
                            const baseName = item.originalName.replace(/\.[^/.]+$/, '');
                            const ext = item.targetFormat.toLowerCase() === 'jpeg' ? 'jpg' : item.targetFormat.toLowerCase();
                            triggerFileDownload(item.resultBlob!, `${baseName}.${ext}`);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-600/30 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <span className="text-xs text-rose-400 bg-rose-950/60 px-2 py-1 rounded">
                        {item.errorMessage || 'Error'}
                      </span>
                    )}

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Explanations & Quick Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Zero Server Uploads</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All conversions are processed directly inside your device's browser memory. Your confidential photos and documents are never transmitted to external servers.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <span>High-Fidelity Encoding</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Preserves color depth, transparent alpha channels, DPI clarity, and metadata across PNG, WebP, JPG, BMP, and vector formats.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Archive className="w-4 h-4" />
            <span>1-Click Bulk ZIP Export</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Convert 20+ images simultaneously and pack them into a structured ZIP archive in a single tap on both desktop and mobile phones.
          </p>
        </div>
      </div>
    </div>
  );
};
