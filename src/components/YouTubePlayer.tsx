import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
  AlertCircle,
  Radio,
  ChevronDown,
  ChevronUp,
  Headphones,
  Check,
  Download,
  Gauge,
  Shuffle,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Sparkles,
  PictureInPicture2,
} from 'lucide-react';
import { UnifiedTrack } from '../types/index.ts';
import {
  LoopMode,
  getStoredLoopMode,
  setStoredLoopMode,
  getStoredSmartShuffle,
  setStoredSmartShuffle,
  generateSmartShuffleQueue,
} from '../services/smartQueue.ts';
import { backgroundAudioKeepAlive } from '../services/backgroundAudioKeepAlive.ts';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  currentTrack: UnifiedTrack | null;
  playlist?: UnifiedTrack[];
  onClose: () => void;
  onSelectTrack?: (track: UnifiedTrack) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onDownload?: (track: UnifiedTrack) => void;
}

// 1-second silent WAV base64 string to keep browser background audio session alive
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A';

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('musichub_audio_only_mode');
  }
} catch {}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  currentTrack,
  playlist = [],
  onClose,
  onSelectTrack,
  onNext,
  onPrevious,
  onDownload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playerError, setPlayerError] = useState<{ code: number; message: string } | null>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isTheater, setIsTheater] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Smart Shuffle and Loop States
  const [loopMode, setLoopMode] = useState<LoopMode>(() => getStoredLoopMode());
  const [isSmartShuffle, setIsSmartShuffle] = useState<boolean>(() => getStoredSmartShuffle());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const historyRef = useRef<UnifiedTrack[]>([]);

  // Refs for callbacks inside event handlers
  const loopModeRef = useRef<LoopMode>(loopMode);
  const isSmartShuffleRef = useRef<boolean>(isSmartShuffle);
  const handleNextTrackRef = useRef<() => void>(() => {});
  // Tracks whether the user intends the song to be playing (true during normal playback and across tab switches)
  const userIntendedPlayingRef = useRef<boolean>(true);

  // Auto-resumes playback if Chrome or browser throttles/pauses in a background tab
  const checkAndForceResume = useCallback(() => {
    if (!userIntendedPlayingRef.current) return;
    if (currentTrack?.playbackType === 'youtube-iframe' && playerRef.current) {
      try {
        const state = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : null;
        // YT states: 2 (paused), -1 (unstarted), 5 (video cued)
        if (state === 2 || state === -1 || state === 5) {
          playerRef.current.playVideo?.();
        }
      } catch {}
    } else if (audioRef.current && audioRef.current.paused && userIntendedPlayingRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentTrack]);

  useEffect(() => {
    loopModeRef.current = loopMode;
    setStoredLoopMode(loopMode);
  }, [loopMode]);

  useEffect(() => {
    isSmartShuffleRef.current = isSmartShuffle;
    setStoredSmartShuffle(isSmartShuffle);
  }, [isSmartShuffle]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  // Background play setting: default true so audio plays even when switching tabs or minimizing
  const [backgroundPlay, setBackgroundPlay] = useState<boolean>(() => {
    try {
      return localStorage.getItem('musichub_background_play') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleBackgroundPlay = () => {
    const nextState = !backgroundPlay;
    setBackgroundPlay(nextState);
    try {
      localStorage.setItem('musichub_background_play', String(nextState));
    } catch {}
    showToast(nextState ? '🎧 Background Play ON: Gaana tabs aur background me chalta rahega!' : 'Background Play OFF');
  };

  const togglePictureInPicture = async () => {
    try {
      if ('documentPictureInPicture' in window) {
        const docPiP = (window as any).documentPictureInPicture;
        if (docPiP.window) {
          docPiP.window.close();
          return;
        }

        const pipWin = await docPiP.requestWindow({
          width: 440,
          height: 380,
        });

        document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
          pipWin.document.head.appendChild(node.cloneNode(true));
        });

        if (containerRef.current) {
          pipWin.document.body.style.margin = '0';
          pipWin.document.body.style.backgroundColor = '#0F172A';
          pipWin.document.body.appendChild(containerRef.current);
        }

        pipWin.addEventListener('pagehide', () => {
          if (containerRef.current) {
            document.body.appendChild(containerRef.current);
          }
        });

        showToast('🪟 Floating Mini Player: Screen par float hoga, Chrome minimize hone par chalta rahega!');
        return;
      }
    } catch (err) {
      console.warn('PiP notice:', err);
    }

    showToast('💡 Background Play ON rakhein taaki tabs switch hone par gaana na ruke!');
  };

  // Record history when track changes
  useEffect(() => {
    if (currentTrack) {
      historyRef.current = [
        currentTrack,
        ...historyRef.current.filter((t) => t.videoId !== currentTrack.videoId),
      ].slice(0, 50);
    }
  }, [currentTrack?.videoId]);

  // Load YouTube IFrame API script once with guaranteed polling readiness
  useEffect(() => {
    let interval: any = null;

    const checkReady = () => {
      if (window.YT && window.YT.Player) {
        setIsApiReady(true);
        if (interval) clearInterval(interval);
        return true;
      }
      return false;
    };

    if (checkReady()) return;

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') previousCallback();
      setIsApiReady(true);
    };

    interval = setInterval(checkReady, 200);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Next Track Logic (Handles Smart Shuffle, Queue Loop, and Standard Advance)
  const handleNextTrack = useCallback(() => {
    userIntendedPlayingRef.current = true;
    if (!playlist || playlist.length === 0) {
      onNext?.();
      return;
    }

    if (playlist.length === 1) {
      // Only 1 song in queue: restart it
      if (currentTrack?.playbackType === 'youtube-iframe') {
        playerRef.current?.seekTo?.(0, true);
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    let nextTrack: UnifiedTrack | undefined;

    if (isSmartShuffleRef.current) {
      // Smart shuffle: avoid recently played, balance channel & vibe
      const historyIds = historyRef.current.map((t) => t.videoId);
      const shuffled = generateSmartShuffleQueue(playlist, currentTrack?.videoId, historyIds);
      nextTrack = shuffled.find((t) => t.videoId !== currentTrack?.videoId) || playlist[0];
    } else {
      // Standard sequential queue
      const currentIndex = playlist.findIndex((t) => t.videoId === currentTrack?.videoId);
      if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
        nextTrack = playlist[currentIndex + 1];
      } else if (loopModeRef.current === 'all' || loopModeRef.current === 'single') {
        nextTrack = playlist[0];
      }
    }

    if (nextTrack && onSelectTrack) {
      onSelectTrack(nextTrack);
    } else if (onNext) {
      onNext();
    }
  }, [playlist, currentTrack, onSelectTrack, onNext]);

  // Sync ref so YT Player event listener can always call latest next track handler
  useEffect(() => {
    handleNextTrackRef.current = handleNextTrack;
  }, [handleNextTrack]);

  // Previous Track Logic (Rewinds to 0 if >3s, or goes to previous history / queue track)
  const handlePreviousTrack = useCallback(() => {
    userIntendedPlayingRef.current = true;
    // If playing for more than 3 seconds, rewind current song to beginning
    if (currentTime > 3) {
      if (currentTrack?.playbackType === 'youtube-iframe') {
        playerRef.current?.seekTo?.(0, true);
        playerRef.current?.playVideo?.();
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setCurrentTime(0);
      return;
    }

    if (!playlist || playlist.length === 0) {
      onPrevious?.();
      return;
    }

    // In smart shuffle, check played history first
    if (isSmartShuffleRef.current && historyRef.current.length > 1) {
      const prevFromHistory = historyRef.current[1];
      if (prevFromHistory && onSelectTrack) {
        onSelectTrack(prevFromHistory);
        return;
      }
    }

    // Standard sequential previous
    const currentIndex = playlist.findIndex((t) => t.videoId === currentTrack?.videoId);
    let prevTrack: UnifiedTrack | undefined;
    if (currentIndex > 0) {
      prevTrack = playlist[currentIndex - 1];
    } else if (loopModeRef.current === 'all') {
      prevTrack = playlist[playlist.length - 1];
    }

    if (prevTrack && onSelectTrack) {
      onSelectTrack(prevTrack);
    } else if (onPrevious) {
      onPrevious();
    }
  }, [currentTime, currentTrack, playlist, onSelectTrack, onPrevious]);

  // Loop Mode Toggle (Cycle: off -> single -> all -> off)
  const toggleLoopMode = () => {
    setLoopMode((prev) => {
      if (prev === 'off') {
        showToast('🔂 Song in Loop: This song will repeat endlessly');
        return 'single';
      }
      if (prev === 'single') {
        showToast('🔁 Queue Loop: Repeating all songs in order');
        return 'all';
      }
      showToast('➡️ Loop Off: Continuous play until end');
      return 'off';
    });
  };

  // Smart Shuffle Toggle
  const toggleSmartShuffle = () => {
    setIsSmartShuffle((prev) => {
      const next = !prev;
      if (next) {
        showToast('✨ Smart Shuffle ON: Intelligent, non-repeating song mix');
      } else {
        showToast('Smart Shuffle OFF: Playing in original order');
      }
      return next;
    });
  };

  // Initialize or update YouTube Player when track changes
  useEffect(() => {
    setPlayerError(null);
    setCurrentTime(0);
    setDuration(0);

    if (!currentTrack) {
      if (playerRef.current) {
        try { playerRef.current.destroy?.(); } catch {}
        playerRef.current = null;
      }
      return;
    }

    // If audio stream (e.g. Jamendo, iTunes preview)
    if (currentTrack.playbackType === 'audio-stream') {
      if (playerRef.current) {
        try { playerRef.current.destroy?.(); } catch {}
        playerRef.current = null;
      }
      userIntendedPlayingRef.current = true;
      setIsPlaying(true);
      if (backgroundPlay) {
        backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
      }
      return;
    }

    // YouTube IFrame Player initialization
    if (!isApiReady || !currentTrack.videoId) return;

    const videoId = currentTrack.videoId;

    // If player already exists, load the new video ID directly
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        userIntendedPlayingRef.current = true;
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(volume || 100);
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: 0,
        });
        playerRef.current.playVideo?.();
        setIsPlaying(true);
        setIsMuted(false);
        if (backgroundPlay) {
          backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
        }
        return;
      } catch (e) {
        // Destroy and fall through to re-create
        try { playerRef.current.destroy?.(); } catch {}
        playerRef.current = null;
      }
    }

    // Ensure DOM container exists and reset its child slot cleanly
    const container = iframeContainerRef.current;
    if (!container) return;

    container.innerHTML = '<div id="musichub-yt-iframe-slot" style="width:100%;height:100%;"></div>';

    try {
      playerRef.current = new window.YT.Player('musichub-yt-iframe-slot', {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            try {
              userIntendedPlayingRef.current = true;
              event.target.unMute();
              event.target.setVolume(volume || 100);
              event.target.playVideo();
              if (backgroundPlay) {
                backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
              }
            } catch (err) {
              console.warn('Playback ready notice:', err);
            }
            setIsPlaying(true);
            setIsMuted(false);
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            if (event.data === 1) {
              setIsPlaying(true);
              userIntendedPlayingRef.current = true;
              setPlayerError(null);
              if (backgroundPlay) {
                backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
              }
              try {
                if (event.target.isMuted()) {
                  setIsMuted(true);
                } else {
                  setIsMuted(false);
                }
              } catch {}
            } else if (event.data === 2) {
              // Pause event
              // Only auto-resume if the browser tab is truly hidden in the background
              if (document.hidden && backgroundPlay && userIntendedPlayingRef.current) {
                try {
                  event.target.playVideo();
                } catch {}
                setTimeout(() => {
                  if (document.hidden && userIntendedPlayingRef.current) {
                    try { event.target.playVideo(); } catch {}
                  }
                }, 150);
                return;
              }

              // Normal user pause or video ended in foreground
              setIsPlaying(false);
            } else if (event.data === 0) {
              // Track has ended!
              if (loopModeRef.current === 'single') {
                try {
                  event.target.seekTo(0, true);
                  event.target.playVideo();
                  setIsPlaying(true);
                  showToast('🔂 Repeating song in loop');
                } catch (loopErr) {
                  console.warn('Loop restart notice:', loopErr);
                }
              } else {
                handleNextTrackRef.current();
              }
            }
          },
          onError: (event: any) => {
            const code = event.data;
            console.warn(`YouTube player code: ${code} for video: ${videoId}`);

            // If video embedding is restricted by owner (101/150) or unavailable (100)
            if (code === 101 || code === 150 || code === 100) {
              // Automatically advance to next song in playlist without stopping the session
              if (playlist && playlist.length > 1) {
                showToast('⏭️ Stream restricted by owner: Playing next song in queue');
                setTimeout(() => {
                  handleNextTrackRef.current();
                }, 1000);
                return;
              }
            }

            let message = 'This video cannot be played directly.';
            if (code === 101 || code === 150) {
              message = 'The owner of this video has restricted third-party embedded playback.';
            } else if (code === 100) {
              message = 'This video is private or unavailable.';
            }
            setPlayerError({ code, message });
            setIsPlaying(false);
          },
        },
      });
    } catch (initErr) {
      console.error('Failed to instantiate YT.Player:', initErr);
    }
  }, [currentTrack?.videoId, isApiReady]);

  // Sync volume with YT player
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      if (isMuted) {
        playerRef.current.mute?.();
      } else {
        playerRef.current.unMute?.();
        playerRef.current.setVolume(volume);
      }
    }
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Media Session API registration for lock screen, background audio, and OS media controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.channelTitle,
          album: 'MusicHub Player',
          artwork: [
            { src: currentTrack.thumbnail, sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.thumbnail, sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
          ],
        });

        navigator.mediaSession.setActionHandler('play', () => {
          if (currentTrack.playbackType === 'youtube-iframe') {
            playerRef.current?.playVideo?.();
          } else {
            audioRef.current?.play();
          }
          setIsPlaying(true);
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (currentTrack.playbackType === 'youtube-iframe') {
            playerRef.current?.pauseVideo?.();
          } else {
            audioRef.current?.pause();
          }
          setIsPlaying(false);
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            if (currentTrack.playbackType === 'youtube-iframe') {
              playerRef.current?.seekTo?.(details.seekTime, true);
            } else if (audioRef.current) {
              audioRef.current.currentTime = details.seekTime;
            }
          }
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          handleNextTrackRef.current();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          handlePreviousTrack();
        });
      } catch (e) {
        console.warn('MediaSession configuration warning:', e);
      }
    }
  }, [currentTrack, handlePreviousTrack]);

  // Background audio keep-alive and visibilitychange prevention
  useEffect(() => {
    if (isPlaying && backgroundPlay) {
      backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
      if (keepAliveAudioRef.current) {
        keepAliveAudioRef.current.play().catch(() => {});
      }
    }

    const handleVisibilityChange = () => {
      // When tab goes to background or user switches tab
      if (document.hidden && backgroundPlay && userIntendedPlayingRef.current) {
        backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
        checkAndForceResume();
        // Schedule follow-ups because Chrome throttles background iframes immediately
        setTimeout(checkAndForceResume, 100);
        setTimeout(checkAndForceResume, 350);
        setTimeout(checkAndForceResume, 850);
      } else if (!document.hidden && userIntendedPlayingRef.current) {
        checkAndForceResume();
      }
    };

    const handleBlur = () => {
      if (backgroundPlay && userIntendedPlayingRef.current) {
        checkAndForceResume();
        setTimeout(checkAndForceResume, 150);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handleBlur);
    };
  }, [isPlaying, backgroundPlay, checkAndForceResume]);

  // Periodic time update ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && isPlaying) {
        try {
          const current = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setCurrentTime(current);
          setDuration(dur);
        } catch {}
      } else if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime || 0);
        setDuration(audioRef.current.duration || 0);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isPlaying]);

  if (!currentTrack) return null;

  const togglePlay = () => {
    if (currentTrack.playbackType === 'audio-stream') {
      if (audioRef.current) {
        if (isPlaying) {
          userIntendedPlayingRef.current = false;
          backgroundAudioKeepAlive.stopKeepAlive();
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          userIntendedPlayingRef.current = true;
          backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
      return;
    }

    if (playerRef.current) {
      try {
        if (isPlaying) {
          userIntendedPlayingRef.current = false;
          backgroundAudioKeepAlive.stopKeepAlive();
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          userIntendedPlayingRef.current = true;
          backgroundAudioKeepAlive.startKeepAlive(checkAndForceResume);
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch {}
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(newTime, true);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(newSpeed);
      } catch (e) {
        console.warn('Failed setting YouTube playback rate:', e);
      }
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatSecs = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      {/* Hidden keep-alive audio element for preventing tab audio suspension */}
      <audio
        ref={keepAliveAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        preload="auto"
        className="hidden"
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        className={`fixed z-50 transition-all duration-300 ease-out bg-[#0F172A] border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-xl ${
          isTheater
            ? 'inset-2 sm:inset-4 md:inset-10 max-w-5xl mx-auto flex flex-col'
            : isMinimized
            ? 'bottom-[54px] md:bottom-4 left-2 right-2 sm:left-auto sm:right-4 w-auto sm:w-[460px]'
            : 'bottom-[54px] md:bottom-4 left-2 right-2 sm:left-auto sm:right-4 md:right-8 w-auto sm:w-[500px] lg:w-[560px]'
        }`}
        role="region"
        aria-label="Official MusicHub Player"
      >
        {/* Floating Quick Toast Notification */}
        {toastMessage && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 bg-slate-900/95 border border-slate-700 text-white text-xs font-semibold rounded-full shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Player Header Bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">
              Now Playing
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 truncate max-w-[100px] sm:max-w-[170px]">
              · {currentTrack.channelTitle}
            </span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Background Playback Toggle */}
            <button
              onClick={toggleBackgroundPlay}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                backgroundPlay
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={
                backgroundPlay
                  ? 'Background Play Active: Music keeps playing across tabs & minimizes'
                  : 'Enable Background Play'
              }
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-medium">
                {backgroundPlay ? 'Background ON' : 'Background OFF'}
              </span>
            </button>

            {/* Document Picture-in-Picture / Floating Window Button */}
            <button
              onClick={togglePictureInPicture}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Floating Mini Player (PiP): Screen ke upar float hoga, Chrome minimize par chalta rahega"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {onDownload && (
              <button
                onClick={() => onDownload(currentTrack)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Download / Save to Device ROM"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            <a
              href={currentTrack.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Open on YouTube / Official Source"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {!isTheater && (
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title={isMinimized ? 'Expand Video' : 'Minimize to Audio Bar'}
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={() => {
                setIsTheater(!isTheater);
                setIsMinimized(false);
              }}
              className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title={isTheater ? 'Exit Theater Mode' : 'Theater Mode'}
            >
              {isTheater ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                userIntendedPlayingRef.current = false;
                backgroundAudioKeepAlive.stopKeepAlive();
                if (playerRef.current) {
                  try {
                    playerRef.current.stopVideo?.();
                  } catch {}
                }
                if (keepAliveAudioRef.current) {
                  keepAliveAudioRef.current.pause();
                }
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video / Audio Viewport */}
        <div
          className={`relative bg-black transition-all duration-200 ${
            isMinimized
              ? 'h-[1px] w-[1px] opacity-10 pointer-events-none absolute -bottom-96'
              : isTheater
              ? 'flex-1 min-h-[300px]'
              : 'aspect-video'
          }`}
        >
          {currentTrack.playbackType === 'youtube-iframe' ? (
            <>
              {/* Target IFrame Div for YouTube Player API - plays complete full-length video and audio */}
              <div
                ref={iframeContainerRef}
                className={`w-full h-full ${playerError ? 'hidden' : 'block'}`}
              />

              {/* Player Error State */}
              {playerError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-slate-200">
                  <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
                  <h4 className="text-sm font-bold text-white mb-1">Official Playback Restricted</h4>
                  <p className="text-xs text-slate-400 max-w-md mb-4">
                    {typeof playerError.message === 'string' ? playerError.message : JSON.stringify(playerError.message)}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleNextTrackRef.current()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg cursor-pointer"
                    >
                      Play Next Song
                    </button>
                    <a
                      href={currentTrack.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      YouTube
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Royalty-Free Full Audio Stream (e.g. Jamendo) */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-center relative overflow-hidden">
              <div className="relative mb-3 group">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shadow-2xl object-cover border-2 border-indigo-500/30 transition-transform duration-500 ${isPlaying ? 'scale-105' : 'scale-100 opacity-80'}`}
                />
                {isPlaying && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-emerald-500/90 text-white font-semibold text-[10px] rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>Playing Audio</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[10px] uppercase font-bold tracking-wider border border-indigo-500/30">
                  Full Audio Stream
                </span>
              </div>

              <h4 className="text-sm font-bold text-white truncate max-w-sm px-4">{currentTrack.title}</h4>
              <p className="text-xs text-slate-400 truncate max-w-xs mb-3">{currentTrack.channelTitle}</p>

              {/* Sound Wave Animation Bars */}
              <div className="flex items-center gap-1 h-4">
                {[40, 70, 95, 60, 85, 45, 90, 65, 30, 80, 55, 90].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-gradient-to-t from-red-500 to-amber-300 rounded-full transition-all duration-300"
                    style={{
                      height: isPlaying ? `${h}%` : '20%',
                      opacity: isPlaying ? 0.9 : 0.3,
                    }}
                  />
                ))}
              </div>

              <audio
                ref={audioRef}
                src={currentTrack.audioStreamUrl || undefined}
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  if (loopModeRef.current === 'single') {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      audioRef.current.play().catch(() => {});
                      setIsPlaying(true);
                      showToast('🔂 Repeating song in loop');
                    }
                  } else {
                    handleNextTrackRef.current();
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Track Info & Persistent Audio Controls Bar */}
        <div className="p-3 sm:p-3.5 bg-slate-900/95 border-t border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Mini album thumbnail when minimized */}
              {isMinimized && (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                />
              )}
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-white truncate" title={currentTrack.title}>
                  {currentTrack.title}
                </h3>
                <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">{currentTrack.channelTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {currentTrack.duration || (duration > 0 ? formatSecs(duration) : 'Full Song')}
                  </span>

                  {/* Active Loop Badge */}
                  {loopMode === 'single' && (
                    <span className="text-[10px] text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex items-center gap-1 shadow-sm">
                      <Repeat1 className="w-3 h-3 text-rose-400" />
                      <span>Song in Loop</span>
                    </span>
                  )}
                  {loopMode === 'all' && (
                    <span className="text-[10px] text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex items-center gap-1">
                      <Repeat className="w-3 h-3 text-blue-400" />
                      <span>Loop All</span>
                    </span>
                  )}

                  {/* Active Smart Shuffle Badge */}
                  {isSmartShuffle && (
                    <span className="text-[10px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Smart Shuffle</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Direct YouTube link button */}
            <a
              href={currentTrack.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-block shrink-0 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
            >
              YouTube
            </a>
          </div>

          {/* Progress scrub bar */}
          {duration > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono tabular-nums text-slate-400 w-9 text-right">
                {formatSecs(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                aria-label="Seek progress"
              />
              <span className="text-[11px] font-mono tabular-nums text-slate-400 w-9">
                {formatSecs(duration)}
              </span>
            </div>
          )}

          {/* Bottom controls row */}
          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            {/* Playback & Queue Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Smart Shuffle Button */}
              <button
                onClick={toggleSmartShuffle}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer relative ${
                  isSmartShuffle
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                }`}
                title={
                  isSmartShuffle
                    ? 'Smart Shuffle ON: Non-repeating intelligent mix (Click to turn off)'
                    : 'Turn on Smart Shuffle (Intelligent, non-repeating song order)'
                }
                aria-label="Toggle Smart Shuffle"
              >
                <Shuffle className="w-4 h-4" />
                <Sparkles
                  className={`w-2.5 h-2.5 ${isSmartShuffle ? 'text-amber-300 animate-pulse' : 'text-slate-500'}`}
                />
                <span className="hidden md:inline text-[10px] font-semibold">
                  {isSmartShuffle ? 'Shuffle ON' : 'Shuffle'}
                </span>
              </button>

              {/* Previous Track Button */}
              <button
                onClick={handlePreviousTrack}
                disabled={!playlist || playlist.length <= 1}
                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-35 disabled:hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Previous Song (or Restart)"
                aria-label="Previous Track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Play / Pause Main Button */}
              <button
                onClick={togglePlay}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-full transition-transform shadow-md flex items-center justify-center cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>

              {/* Next Track Button */}
              <button
                onClick={handleNextTrack}
                disabled={!playlist || playlist.length <= 1}
                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-35 disabled:hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Next Song"
                aria-label="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Loop Song / Loop All Mode Button */}
              <button
                onClick={toggleLoopMode}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer relative ${
                  loopMode === 'single'
                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/25'
                    : loopMode === 'all'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                }`}
                title={
                  loopMode === 'single'
                    ? 'Song in Loop Active: Repeating this song endlessly (Click to change)'
                    : loopMode === 'all'
                    ? 'Queue Loop Active: Repeating entire playlist (Click to turn off)'
                    : 'Loop Off: Click to loop this song endlessly'
                }
                aria-label="Toggle Loop Mode"
              >
                {loopMode === 'single' ? (
                  <Repeat1 className="w-4 h-4 text-rose-300" />
                ) : (
                  <Repeat className={`w-4 h-4 ${loopMode === 'all' ? 'text-blue-300' : ''}`} />
                )}
                <span className="hidden sm:inline text-[10px] font-bold">
                  {loopMode === 'single' ? 'Loop Song' : loopMode === 'all' ? 'Loop All' : 'Loop'}
                </span>
              </button>
            </div>

            {/* Volume & Audio Speed Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (playerRef.current) {
                    if (nextMuted) {
                      playerRef.current.mute?.();
                    } else {
                      playerRef.current.unMute?.();
                      playerRef.current.setVolume?.(volume || 100);
                    }
                  }
                  if (audioRef.current) {
                    audioRef.current.muted = nextMuted;
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isMuted ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white'
                }`}
                title={isMuted ? 'Click to Unmute Speaker Output' : 'Mute Speaker'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="hidden sm:block w-12 sm:w-16 md:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                aria-label="Volume slider"
              />

              {/* Playback Speed Control Selector (0.5x to 2.0x) */}
              <div className="flex items-center gap-1 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-xs transition-colors shrink-0">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                  aria-label="Playback speed"
                  title="Adjust listening speed"
                >
                  <option value={0.5} className="bg-slate-900 text-white">0.5x</option>
                  <option value={0.75} className="bg-slate-900 text-white">0.75x</option>
                  <option value={1} className="bg-slate-900 text-white">1.0x</option>
                  <option value={1.25} className="bg-slate-900 text-white">1.25x</option>
                  <option value={1.5} className="bg-slate-900 text-white">1.5x</option>
                  <option value={1.75} className="bg-slate-900 text-white">1.75x</option>
                  <option value={2} className="bg-slate-900 text-white">2.0x</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
