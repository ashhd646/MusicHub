import React, { useState, useRef, useEffect } from 'react';
import {
  FileAudio,
  Upload,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  HardDrive,
  Play,
  Pause,
  Music,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Mic,
  Square,
  Radio,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { UnifiedTrack } from '../types/index.ts';
import {
  convertVideoFileToMp3,
  convertAudioStreamUrlToMp3,
  encodeAudioBufferToMp3,
  triggerBlobDownload,
  ConversionProgress,
} from '../services/videoToMp3Converter.ts';
import { openPagalworldDownload } from '../services/pagalworldService.ts';

interface VideoToMp3ModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedTracks: UnifiedTrack[];
  initialSelectedTrack?: UnifiedTrack | null;
}

export const VideoToMp3Modal: React.FC<VideoToMp3ModalProps> = ({
  isOpen,
  onClose,
  savedTracks,
  initialSelectedTrack,
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'upload'>('saved');
  const [selectedTrack, setSelectedTrack] = useState<UnifiedTrack | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bitrate, setBitrate] = useState<number>(192);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRequestingAudio, setIsRequestingAudio] = useState<boolean>(false);
  const [recordMode, setRecordMode] = useState<'mic' | 'tab'>('mic');
  const [recordingSecs, setRecordingSecs] = useState<number>(0);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [convertedMp3, setConvertedMp3] = useState<{
    blob: Blob;
    url: string;
    filename: string;
    sizeMb: string;
    durationSecs: number;
  } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  useEffect(() => {
    if (initialSelectedTrack) {
      setSelectedTrack(initialSelectedTrack);
      setActiveTab('saved');
    } else if (savedTracks.length > 0 && !selectedTrack) {
      setSelectedTrack(savedTracks[0]);
    }
  }, [initialSelectedTrack, savedTracks]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setConvertedMp3(null);
      setProgress(null);
      setRecordError(null);
    }
  };

  const handleConvertFile = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setProgress({
      status: 'reading',
      percent: 5,
      message: 'Reading video file...',
    });

    try {
      const result = await convertVideoFileToMp3(selectedFile, bitrate, (prog) => {
        setProgress(prog);
      });

      const mp3Url = URL.createObjectURL(result.blob);
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const filename = `${baseName}.mp3`;

      setConvertedMp3({
        blob: result.blob,
        url: mp3Url,
        filename,
        sizeMb: (result.sizeBytes / (1024 * 1024)).toFixed(2),
        durationSecs: Math.round(result.duration),
      });
    } catch (err: any) {
      console.error('Video to MP3 conversion error:', err);
      setProgress({
        status: 'error',
        percent: 0,
        message:
          err.message ||
          'Failed to extract audio from video. Make sure the video contains an audio track.',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Convert open audio stream
  const handleConvertSavedTrack = async () => {
    if (!selectedTrack) return;

    if (selectedTrack.audioStreamUrl) {
      setIsConverting(true);
      setProgress({
        status: 'reading',
        percent: 5,
        message: 'Fetching audio stream for conversion...',
      });

      try {
        const result = await convertAudioStreamUrlToMp3(
          selectedTrack.audioStreamUrl,
          bitrate,
          (prog) => setProgress(prog)
        );

        const mp3Url = URL.createObjectURL(result.blob);
        const sanitizedTitle = selectedTrack.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'song';
        const filename = `${sanitizedTitle}.mp3`;

        setConvertedMp3({
          blob: result.blob,
          url: mp3Url,
          filename,
          sizeMb: (result.sizeBytes / (1024 * 1024)).toFixed(2),
          durationSecs: Math.round(result.duration),
        });
      } catch (err: any) {
        console.error('Track conversion error:', err);
        setProgress({
          status: 'error',
          percent: 0,
          message: err.message || 'Failed to convert audio stream to MP3.',
        });
      } finally {
        setIsConverting(false);
      }
    }
  };

  // Live Song Audio Recorder
  const startRecordingAudio = async (mode: 'mic' | 'tab' = recordMode) => {
    setRecordError(null);
    setIsRequestingAudio(true);

    try {
      if (!navigator.mediaDevices) {
        throw new Error('Your browser does not support web audio recording.');
      }

      audioChunksRef.current = [];
      let stream: MediaStream;

      if (mode === 'tab' && navigator.mediaDevices.getDisplayMedia) {
        // Tab / System audio capture
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          if (stream.getAudioTracks().length === 0) {
            stream.getTracks().forEach((t) => t.stop());
            throw new Error('No audio track was selected. Please make sure "Share audio" is checked, or switch to Microphone recording.');
          }
        } catch (tabErr: any) {
          if (tabErr.name === 'NotAllowedError') {
            throw new Error('Tab audio selection was cancelled.');
          }
          throw tabErr;
        }
      } else {
        // Microphone / Speaker capture
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      // Check supported MIME type
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }

        const recordedBlobType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedBlobType });
        setIsConverting(true);
        setProgress({
          status: 'decoding',
          percent: 20,
          message: 'Converting recorded song audio into high-fidelity MP3...',
        });

        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const mp3Blob = await encodeAudioBufferToMp3(audioBuffer, bitrate, (prog) => setProgress(prog));

          const mp3Url = URL.createObjectURL(mp3Blob);
          const baseName = (selectedTrack?.title || 'recorded_song').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
          const filename = `${baseName}.mp3`;

          setConvertedMp3({
            blob: mp3Blob,
            url: mp3Url,
            filename,
            sizeMb: (mp3Blob.size / (1024 * 1024)).toFixed(2),
            durationSecs: Math.round(audioBuffer.duration),
          });
          triggerBlobDownload(mp3Blob, filename);
        } catch (err: any) {
          console.error('Recording conversion error:', err);
          setProgress({
            status: 'error',
            percent: 0,
            message: 'Failed to process recorded audio. Please try again or use direct VidMate converter.',
          });
        } finally {
          setIsConverting(false);
          setIsRecording(false);
          setRecordingSecs(0);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSecs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSecs((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Audio capture error:', err);
      let errorMsg = 'Could not access audio.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
        errorMsg =
          'Microphone / Audio access was denied by your browser or restricted in this window. You can enable microphone permissions in your browser address bar, or use the 1-click VidMate & direct converter options below!';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No audio input or microphone device found on your device.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setRecordError(errorMsg);
    } finally {
      setIsRequestingAudio(false);
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDownload = () => {
    if (convertedMp3) {
      triggerBlobDownload(convertedMp3.blob, convertedMp3.filename);
    }
  };

  const handleReset = () => {
    if (convertedMp3?.url) {
      URL.revokeObjectURL(convertedMp3.url);
    }
    if (isRecording) {
      stopRecordingAudio();
    }
    setConvertedMp3(null);
    setProgress(null);
    setRecordError(null);
    setIsPlayingPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePreview = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const formatSecs = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const videoUrl = selectedTrack ? `https://www.youtube.com/watch?v=${selectedTrack.videoId}` : '';

  const handleCopyLink = () => {
    if (videoUrl) {
      navigator.clipboard.writeText(videoUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
              <FileAudio className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">Video to MP3 Converter</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Convert videos & save real high-quality MP3</p>
            </div>
          </div>

          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        {!convertedMp3 && (
          <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 sm:px-6 pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('saved');
                setRecordError(null);
              }}
              className={`pb-2.5 sm:pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'saved'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Convert Saved Song / YouTube</span>
              <span className="sm:hidden">Online Song</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setRecordError(null);
              }}
              className={`pb-2.5 sm:pb-3 px-2 sm:px-3 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Convert Video File from Device</span>
              <span className="sm:hidden">Video File</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Tab 1: Convert Saved Songs */}
          {activeTab === 'saved' && !convertedMp3 && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selected Song to Convert:
              </label>

              {selectedTrack ? (
                <div className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl space-y-4">
                  {/* Song Details */}
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedTrack.thumbnail}
                      alt={selectedTrack.title}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0 shadow-md"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white truncate" title={selectedTrack.title}>
                        {selectedTrack.title}
                      </h4>
                      <p className="text-xs text-rose-300 truncate mt-0.5 font-medium">{selectedTrack.channelTitle}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="font-mono text-emerald-400 font-semibold">{selectedTrack.duration || 'Full Duration'}</span>
                        <span>·</span>
                        <span>Original Song Audio</span>
                      </div>
                    </div>
                  </div>

                  {/* YouTube Song Download Solutions */}
                  {selectedTrack.source === 'youtube' ? (
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>Real Audio Conversion & Download Options:</span>
                      </div>

                      {/* Error notice if audio capture / mic fails */}
                      {recordError && (
                        <div className="p-3.5 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold text-white">Audio Capture Notice</p>
                            <p className="text-[11px] text-red-300 leading-relaxed">{recordError}</p>
                          </div>
                        </div>
                      )}

                      {/* PagalWorld 1-Click Direct MP3 Download Option */}
                      <div className="p-3.5 bg-gradient-to-r from-rose-950/70 via-red-950/60 to-slate-900 border border-rose-500/50 rounded-xl space-y-2.5 shadow-lg shadow-rose-950/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Direct 320kbps MP3 on PagalWorld (Instant 1-Click)</span>
                          </span>
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30 font-semibold">
                            Recommended
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Opens the exact original studio audio download page for <strong className="text-white">"{selectedTrack.title}"</strong> on PagalWorld for instant mobile download!
                        </p>
                        <button
                          type="button"
                          onClick={() => openPagalworldDownload(selectedTrack)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          <FileAudio className="w-4 h-4 text-white" />
                          <span>Open PagalWorld Download Page ➔</span>
                        </button>
                      </div>

                      {/* Method 1: Live Audio to MP3 Recorder */}
                      <div className="p-3.5 bg-slate-950/70 border border-rose-500/30 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-rose-400" />
                            <span>Method 1: Capture & Convert Song to Real MP3</span>
                          </span>
                          {isRecording && (
                            <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              <span>Recording: {formatSecs(recordingSecs)}</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Play the song in the player and capture the audio in full duration. It records the actual sound and encodes a clean 192kbps MP3 directly to your device!
                        </p>

                        {/* Capture Mode Toggle */}
                        {!isRecording && (
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setRecordMode('mic')}
                              className={`py-1.5 px-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                                recordMode === 'mic'
                                  ? 'bg-rose-950/50 border-rose-500/60 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="font-semibold flex items-center gap-1">
                                <Mic className="w-3 h-3 text-rose-400" />
                                <span>Speaker / Mic</span>
                              </div>
                              <span className="text-[10px] text-slate-500">From phone/laptop speaker</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRecordMode('tab')}
                              className={`py-1.5 px-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                                recordMode === 'tab'
                                  ? 'bg-rose-950/50 border-rose-500/60 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="font-semibold flex items-center gap-1">
                                <Volume2 className="w-3 h-3 text-rose-400" />
                                <span>Tab Digital Audio</span>
                              </div>
                              <span className="text-[10px] text-slate-500">Pure digital sound (PC)</span>
                            </button>
                          </div>
                        )}

                        {isRecording ? (
                          <div className="space-y-2">
                            {/* Animated Audio Waveform Effect */}
                            <div className="flex items-center justify-center gap-1 h-6 py-1">
                              {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7, 0.95, 0.4].map((scale, i) => (
                                <span
                                  key={i}
                                  className="w-1 bg-rose-500 rounded-full animate-pulse"
                                  style={{
                                    height: `${Math.round(scale * 20)}px`,
                                    animationDelay: `${i * 120}ms`,
                                  }}
                                />
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={stopRecordingAudio}
                              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Square className="w-4 h-4 fill-white" />
                              <span>Stop & Download Real MP3 ({formatSecs(recordingSecs)})</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startRecordingAudio(recordMode)}
                            disabled={isRequestingAudio}
                            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isRequestingAudio ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Requesting Audio Access...</span>
                              </>
                            ) : (
                              <>
                                <Radio className="w-4 h-4 text-white" />
                                <span>Start Recording Real Song Audio</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Method 2: 1-Click VidMate Integration */}
                      <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Method 2: Download directly in VidMate</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          For VidMate users on Android, open directly or copy the video link to download 320kbps MP3:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={`intent://www.youtube.com/watch?v=${selectedTrack.videoId}#Intent;package=com.nemo.vidmate;scheme=https;end`}
                            className="py-2.5 px-3 bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span>Open in VidMate</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-rose-400" />}
                            <span>{copiedLink ? 'Copied!' : 'Copy Video Link'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Method 3: Instant 1-Click Fast Web MP3 Downloaders */}
                      <div className="pt-1 space-y-1.5">
                        <span className="text-[11px] text-slate-400 font-medium">Alternative 1-Click High-Speed MP3 Converters:</span>
                        <div className="grid grid-cols-3 gap-2">
                          <a
                            href={`https://dirpy.com/studio/${selectedTrack.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-850 flex items-center justify-center gap-1 transition-colors text-center"
                          >
                            <span className="truncate">Dirpy MP3</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                          </a>
                          <a
                            href={`https://loader.to/?link=https://www.youtube.com/watch?v=${selectedTrack.videoId}&f=mp3`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-850 flex items-center justify-center gap-1 transition-colors text-center"
                          >
                            <span className="truncate">Loader.to</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                          </a>
                          <a
                            href={`https://y2meta.mobi/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-850 flex items-center justify-center gap-1 transition-colors text-center"
                          >
                            <span className="truncate">Y2Meta</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Open audio track with direct stream */
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        onClick={handleConvertSavedTrack}
                        disabled={isConverting}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Convert & Download Real Song MP3</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                  <HardDrive className="w-8 h-8 mx-auto text-slate-500" />
                  <p className="text-sm font-semibold text-white">No song selected</p>
                  <p className="text-xs text-slate-400">Save a song first or pick a video from your device!</p>
                </div>
              )}

              {/* Other Saved Songs Selector */}
              {savedTracks.length > 1 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs text-slate-400 font-medium">Or switch to another saved song:</span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {savedTracks.map((track) => (
                      <div
                        key={track.videoId}
                        onClick={() => {
                          setSelectedTrack(track);
                          setRecordError(null);
                        }}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          selectedTrack?.videoId === track.videoId
                            ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="truncate max-w-xs">{track.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{track.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Upload Video File */}
          {activeTab === 'upload' && !convertedMp3 && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Video File from Your Phone / PC (.mp4, .webm, .mov)
              </label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-rose-500/60 bg-rose-950/20'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 flex items-center justify-center text-rose-400 mb-3 shadow-md">
                  <Upload className="w-6 h-6" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white truncate max-w-md mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-rose-300 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Video Ready
                    </p>
                    <p className="text-[11px] text-slate-400 pt-1">Click to choose a different video</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-200">
                      Click to choose video from device or drag & drop here
                    </p>
                    <p className="text-xs text-slate-400">
                      Extracts 100% of the real audio track into MP3 in 2 seconds
                    </p>
                  </div>
                )}
              </div>

              {/* Bitrate & Quality Selection for file upload */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Audio Quality
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { rate: 128, label: '128 kbps', sub: 'Standard' },
                    { rate: 192, label: '192 kbps', sub: 'High Quality' },
                    { rate: 320, label: '320 kbps', sub: 'Ultra HD' },
                  ].map((opt) => (
                    <button
                      key={opt.rate}
                      type="button"
                      onClick={() => setBitrate(opt.rate)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        bitrate === opt.rate
                          ? 'border-rose-500 bg-rose-950/40 text-white shadow-md'
                          : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedFile && (
                <button
                  type="button"
                  onClick={handleConvertFile}
                  disabled={isConverting}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileAudio className="w-4 h-4" />
                  <span>{isConverting ? 'Extracting & Encoding MP3...' : 'Convert Video File to Real MP3'}</span>
                </button>
              )}
            </div>
          )}

          {/* Conversion Progress Bar */}
          {isConverting && progress && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-rose-300 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progress.message}</span>
                </div>
                <span className="font-mono font-bold text-white">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-all duration-200 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Notice */}
          {progress?.status === 'error' && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{progress.message}</span>
              </div>
            </div>
          )}

          {/* Conversion Success & Download Screen */}
          {convertedMp3 && (
            <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Conversion Complete! Real MP3 Ready</span>
              </div>

              {/* Converted Track Info */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate max-w-xs" title={convertedMp3.filename}>
                      {convertedMp3.filename}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {convertedMp3.sizeMb} MB · {formatSecs(convertedMp3.durationSecs)} · {bitrate} kbps MP3
                    </p>
                  </div>
                </div>

                {/* Preview Play/Pause Button */}
                <button
                  type="button"
                  onClick={togglePreview}
                  className="p-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-full transition-transform shadow-md cursor-pointer shrink-0"
                  title={isPlayingPreview ? 'Pause Audio Preview' : 'Play Audio Preview'}
                >
                  {isPlayingPreview ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>

                <audio
                  ref={audioPreviewRef}
                  src={convertedMp3.url}
                  onEnded={() => setIsPlayingPreview(false)}
                  className="hidden"
                />
              </div>

              {/* Direct Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download MP3 to Device Storage (ROM)</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          {convertedMp3 ? (
            <button
              onClick={handleReset}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Convert Another Track
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
