import React, { useState, useRef } from 'react';
import {
  Minimize2,
  Upload,
  Download,
  Trash2,
  Sliders,
  CheckCircle2,
  Zap,
  TrendingDown,
  Archive,
  Eye,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  compressImage,
  downloadFilesAsZip,
  triggerFileDownload,
  formatBytes,
  getImageDimensions,
} from '../../services/imageTools.ts';

interface CompressedItem {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  resultBlob?: Blob;
  resultUrl?: string;
  compressedSize?: number;
  savedPercent?: number;
  savedBytes?: number;
  resultWidth?: number;
  resultHeight?: number;
  filename?: string;
  errorMessage?: string;
}

const PRESETS = [
  { label: 'Ultra Small', quality: 0.25, scale: 50, desc: 'Maximum compression' },
  { label: 'Balanced (Recommended)', quality: 0.65, scale: 100, desc: 'Great quality, tiny size' },
  { label: 'High Quality', quality: 0.82, scale: 100, desc: 'Near lossless' },
  { label: 'Maximum Fidelity', quality: 0.92, scale: 100, desc: 'Light compression' },
];

export const ImageCompressor: React.FC = () => {
  const [items, setItems] = useState<CompressedItem[]>([]);
  const [quality, setQuality] = useState<number>(0.65);
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [targetFormat, setTargetFormat] = useState<'keep' | 'webp' | 'jpeg'>('keep');
  const [isCompressingAll, setIsCompressingAll] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [inspectItem, setInspectItem] = useState<CompressedItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: CompressedItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const id = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;
      const { width, height, previewUrl } = await getImageDimensions(file);

      newItems.push({
        id,
        file,
        previewUrl,
        originalName: file.name,
        originalSize: file.size,
        originalWidth: width,
        originalHeight: height,
        status: 'idle',
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((i) => i.id !== id);
    });
    if (inspectItem?.id === id) setInspectItem(null);
  };

  const clearAll = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setItems([]);
    setInspectItem(null);
  };

  const compressSingle = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'processing', errorMessage: undefined } : i))
    );

    try {
      const res = await compressImage(item.file, {
        quality,
        scalePercent,
        format: targetFormat,
      });

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'done',
                resultBlob: res.blob,
                resultUrl: res.url,
                compressedSize: res.compressedSize,
                savedPercent: res.savedPercent,
                savedBytes: res.savedBytes,
                resultWidth: res.width,
                resultHeight: res.height,
                filename: res.filename,
              }
            : i
        )
      );

      // If inspecting this item, update inspection state
      if (inspectItem?.id === id) {
        setInspectItem((prev) =>
          prev
            ? {
                ...prev,
                status: 'done',
                resultBlob: res.blob,
                resultUrl: res.url,
                compressedSize: res.compressedSize,
                savedPercent: res.savedPercent,
                savedBytes: res.savedBytes,
              }
            : null
        );
      }
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'error', errorMessage: err.message || 'Compression error' } : i
        )
      );
    }
  };

  const compressAll = async () => {
    if (items.length === 0) return;
    setIsCompressingAll(true);

    for (const item of items) {
      await compressSingle(item.id);
    }

    setIsCompressingAll(false);
  };

  const downloadAllZip = async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBlob);
    if (doneItems.length === 0) return;

    setIsZipping(true);
    try {
      const filesToZip = doneItems.map((item) => ({
        filename: item.filename || item.originalName,
        blob: item.resultBlob!,
      }));

      await downloadFilesAsZip(filesToZip, `compressed_images_${Date.now()}.zip`);
    } catch (e) {
      console.error('Failed to create ZIP', e);
    } finally {
      setIsZipping(false);
    }
  };

  const completedItems = items.filter((i) => i.status === 'done');
  const totalOriginalBytes = items.reduce((acc, curr) => acc + curr.originalSize, 0);
  const totalCompressedBytes = completedItems.reduce((acc, curr) => acc + (curr.compressedSize || curr.originalSize), 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
  const totalSavedPercent = totalOriginalBytes > 0 ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-teal-950/60 border border-emerald-900/50 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Smart Image Compressor
              </span>
              <span className="text-xs text-slate-400">Zero Loss in Clarity</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Minimize2 className="w-6 h-6 text-emerald-400" />
              Compress & Optimize Images up to 90%
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Reduce image file sizes for websites, emails, and mobile phones with instant live preview. Control quality, resize resolution, and batch-export in seconds.
            </p>
          </div>

          {/* Savings Metric */}
          {completedItems.length > 0 && (
            <div className="bg-emerald-950/80 border border-emerald-700/60 rounded-xl px-4 py-2.5 text-center shrink-0 shadow-lg shadow-emerald-900/20">
              <div className="text-[11px] text-emerald-300 font-medium">Total Size Saved</div>
              <div className="text-xl font-bold text-emerald-400 font-mono flex items-center justify-center gap-1">
                <TrendingDown className="w-4 h-4" />
                <span>{totalSavedPercent}% ({formatBytes(totalSavedBytes)})</span>
              </div>
            </div>
          )}
        </div>

        {/* Presets */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Presets:
          </span>
          {PRESETS.map((p) => {
            const isSelected = Math.round(quality * 100) === Math.round(p.quality * 100) && scalePercent === p.scale;
            return (
              <button
                key={p.label}
                onClick={() => {
                  setQuality(p.quality);
                  setScalePercent(p.scale);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400 font-semibold'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={() => fileInputRef.current?.click()}
        className="group relative border-2 border-dashed border-slate-700 hover:border-emerald-500/80 bg-slate-900/40 hover:bg-emerald-950/20 rounded-2xl p-8 sm:p-10 transition-all text-center cursor-pointer overflow-hidden shadow-inner"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/10 group-hover:bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-emerald-500/10">
            <Minimize2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <p className="text-base sm:text-lg font-semibold text-white">
              Drop images to compress, or <span className="text-emerald-400 underline underline-offset-4">browse files</span>
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              JPG, PNG, WEBP, BMP, AVIF supported. Batch compression supported.
            </p>
          </div>
        </div>
      </div>

      {/* Global Compression Settings Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Compression Controls</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Quality Slider */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Quality Level:</span>
              <span className="font-mono font-bold text-emerald-400">{Math.round(quality * 100)}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round(quality * 100)}
              onChange={(e) => setQuality(Number(e.target.value) / 100)}
              className="w-full h-1.5 accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Small Size</span>
              <span>High Quality</span>
            </div>
          </div>

          {/* Scale Resolution Slider */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Resize Scale:</span>
              <span className="font-mono font-bold text-emerald-400">{scalePercent}%</span>
            </div>
            <input
              type="range"
              min="25"
              max="100"
              step="5"
              value={scalePercent}
              onChange={(e) => setScalePercent(Number(e.target.value))}
              className="w-full h-1.5 accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1/4 Resolution</span>
              <span>Original Size</span>
            </div>
          </div>

          {/* Output Format Optimiser */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
            <label className="text-xs text-slate-400 font-medium block">Format Conversion:</label>
            <select
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-emerald-300 py-1.5 px-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="keep">Keep Original Extension</option>
              <option value="webp">Convert to WEBP (Extra 30% Smaller)</option>
              <option value="jpeg">Convert to JPG</option>
            </select>
            <p className="text-[10px] text-slate-500">WEBP offers the highest compression ratio.</p>
          </div>
        </div>

        {/* Action Buttons */}
        {items.length > 0 && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
            <div className="text-xs text-slate-400">
              {items.length} {items.length === 1 ? 'image' : 'images'} ready for optimization
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={compressAll}
                disabled={isCompressingAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCompressingAll ? 'animate-spin' : ''}`} />
                <span>{isCompressingAll ? 'Compressing...' : 'Compress All'}</span>
              </button>

              {completedItems.length > 1 && (
                <button
                  onClick={downloadAllZip}
                  disabled={isZipping}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-teal-300 bg-teal-950/60 hover:bg-teal-900/60 border border-teal-700/60 transition-all cursor-pointer shadow"
                >
                  <Archive className="w-3.5 h-3.5 text-teal-400" />
                  <span>{isZipping ? 'Packaging...' : 'Download All as ZIP'}</span>
                </button>
              )}

              <button
                onClick={clearAll}
                className="p-2 text-slate-400 hover:text-rose-400 bg-slate-950/60 hover:bg-rose-950/30 border border-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
            >
              {/* Thumbnail & Dimensions */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 relative">
                  <img src={item.previewUrl} alt={item.originalName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium text-white truncate max-w-xs sm:max-w-md">
                    {item.originalName}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-slate-300 font-medium">{formatBytes(item.originalSize)}</span>
                    <span>•</span>
                    <span>{item.originalWidth}×{item.originalHeight}px</span>
                  </div>
                </div>
              </div>

              {/* Compression Result & Action */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                {item.status === 'done' && item.compressedSize !== undefined && (
                  <div className="flex items-center gap-2 sm:gap-3 text-right">
                    <div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {formatBytes(item.compressedSize)}
                      </div>
                      <div className="text-[10px] text-emerald-500/90 font-mono font-bold">
                        -{item.savedPercent}% ({formatBytes(item.savedBytes || 0)} saved)
                      </div>
                    </div>

                    <button
                      onClick={() => setInspectItem(item)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                      title="Inspect side by side"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => triggerFileDownload(item.resultBlob!, item.filename || item.originalName)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-600/30 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                )}

                {item.status === 'idle' && (
                  <button
                    onClick={() => compressSingle(item.id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer"
                  >
                    Compress
                  </button>
                )}

                {item.status === 'processing' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Optimizing...</span>
                  </div>
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
          ))}
        </div>
      )}

      {/* Side-by-side Inspection Modal */}
      {inspectItem && inspectItem.resultUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Side-by-Side Quality Comparison
                </h3>
                <p className="text-xs text-slate-400">{inspectItem.originalName}</p>
              </div>
              <button
                onClick={() => setInspectItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Original Image</span>
                  <span className="font-mono text-slate-400">{formatBytes(inspectItem.originalSize)}</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center p-2 min-h-[260px] max-h-[380px]">
                  <img
                    src={inspectItem.previewUrl}
                    alt="Original"
                    className="max-w-full max-h-[360px] object-contain rounded"
                  />
                </div>
              </div>

              {/* Compressed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">Compressed ({formatBytes(inspectItem.compressedSize || 0)})</span>
                  <span className="font-mono text-emerald-300 font-bold">-{inspectItem.savedPercent}% Smaller</span>
                </div>
                <div className="rounded-xl border border-emerald-900/50 bg-slate-950 overflow-hidden flex items-center justify-center p-2 min-h-[260px] max-h-[380px]">
                  <img
                    src={inspectItem.resultUrl}
                    alt="Compressed"
                    className="max-w-full max-h-[360px] object-contain rounded"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Notice: Visual difference is virtually imperceptible with massive file size reduction!
              </span>
              <button
                onClick={() => {
                  triggerFileDownload(inspectItem.resultBlob!, inspectItem.filename || inspectItem.originalName);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Compressed ({formatBytes(inspectItem.compressedSize || 0)})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
