
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VideoFile, MediaDB } from '../services/db';
import { formatDuration } from '../utils/formatters';
import { srtToVtt } from '../utils/srt2vtt';
import { getFileWithPermission } from '../utils/fileSystem';
import { LibraryInfo } from '../types';
import { getDominantColor } from '../utils/color';

// New, consistent, and intuitive line icon set
const PlayIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>);
const PauseIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75zm9 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>);
const VolumeHighIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>);
const VolumeOffIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>);
const Replay10Icon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M1 4v6h6"/><path strokeLinecap="round" strokeLinejoin="round" d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>);
const Forward10Icon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6"/><path strokeLinecap="round" strokeLinejoin="round" d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>);
const FullscreenIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m4.5 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>);
const FullscreenExitIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" /></svg>);
const SubtitlesIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M21 4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H21C22.1 20 23 19.1 23 18V6C23 4.9 22.1 4 21 4ZM8 15H5.5V13.5H8V15ZM13.5 15H11V13.5H13.5V15ZM19 15H16.5V13.5H19V15ZM19 10.5H5V8H19V10.5Z" /></svg>);
const CloseIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const SkipPreviousIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 19.5V4.5" /></svg>);
const SkipNextIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M18 4.5v15" /></svg>);
const PlaylistIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>);
const VideoPlaceholderIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-1.66-1.34-3-3-3s-3 1.34-3 3v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V6h1v4.5c0 1.38-1.12 2.5-2.5 2.5S10 11.88 10 10.5V7c0-2.21 1.79-4 4-4s4 1.79 4 4v3.5c0 1.93-1.57 3.5-3.5 3.5S11 15.43 11 13.5V6H9.5v7.5c0 2.76 2.24 5 5 5s5-2.24 5-5V7h-1.5v3.5z"/></svg>);
const FolderIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2h-8l-2-2z"></path></svg>);
const ReturnIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7h-2z"></path></svg>);
const FilmReelIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM6 18H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V8h2v2zm12 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V8h2v2z"></path></svg>);

interface PlayerProps {
  video: VideoFile;
  on_close: () => void;
  allVideos: VideoFile[];
  activeLibrary: LibraryInfo;
}

type PlaylistItemData = 
  | { type: 'video'; data: VideoFile }
  | { type: 'folder'; data: { path: string; name: string } }
  | { type: 'parent'; data: { path: string; name: string } };

const LANG_MAP: Record<string, string> = {
    en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano',
    pt: 'Português', ru: 'Русский', ja: '日本語', zh: '中文', ar: 'العربية', hi: 'हिन्दी'
};

const getSubtitleDisplayName = (sub: { lang: string; label: string }): string => {
    const langName = LANG_MAP[sub.lang.toLowerCase()];
    return langName ? `${langName}` : sub.label;
};

const PlaylistItem: React.FC<{
    item: PlaylistItemData;
    onVideoClick: (video: VideoFile) => void;
    onFolderClick: (path: string) => void;
    isActive: boolean;
}> = ({ item, onVideoClick, onFolderClick, isActive }) => {
    const [posterUrl, setPosterUrl] = useState<string | null>(null);

    useEffect(() => {
        let url: string | null = null;
        if (item.type === 'video' && item.data.poster) {
            url = URL.createObjectURL(item.data.poster);
            setPosterUrl(url);
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [item]);

    const commonButtonClasses = "w-full text-left p-0.5 rounded-md transition-colors flex items-center space-x-1";

    if (item.type === 'folder' || item.type === 'parent') {
        const folder = item.data;
        const Icon = item.type === 'folder' ? FolderIcon : ReturnIcon;
        return (
             <li>
                <button onClick={() => onFolderClick(folder.path)} className={`${commonButtonClasses} hover:bg-brand-gray`}>
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-xs text-gray-200">{folder.name}</p>
                    </div>
                </button>
            </li>
        );
    }

    const video = item.data;
    return (
        <li>
            <button
                onClick={() => onVideoClick(video)}
                className={`${commonButtonClasses} ${isActive ? 'player-active-bg-light' : 'hover:bg-brand-gray'}`}
            >
                <div className="w-28 h-[63px] flex-shrink-0 bg-brand-gray rounded-md overflow-hidden relative">
                    {posterUrl ? (
                        <img src={posterUrl} alt={video.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                           <VideoPlaceholderIcon className="w-6 h-6 text-gray-500"/>
                        </div>
                    )}
                    {video.duration && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">
                            {formatDuration(video.duration)}
                        </span>
                    )}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className={`font-semibold text-xs leading-tight ${isActive ? 'text-white' : 'text-gray-200'}`}>{video.name.replace(/\.[^/.]+$/, "")}</p>
                </div>
            </button>
        </li>
    );
};

export const Player: React.FC<PlayerProps> = ({ video: initialVideo, on_close, allVideos }) => {
  const [video, setVideo] = useState(initialVideo);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<{ src: string; lang: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSubtitleMenuOpen, setIsSubtitleMenuOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [activeTrackLabel, setActiveTrackLabel] = useState<string | null>(null);
  const [playlistPath, setPlaylistPath] = useState(initialVideo.parentPath);

  const [isVisible, setIsVisible] = useState(false);
  const [ambilightUrl, setAmbilightUrl] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [isCinematicMode, setIsCinematicMode] = useState(false);
  const [preloadedUrl, setPreloadedUrl] = useState<string | null>(null);
  const [showTitleCard, setShowTitleCard] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const subtitleMenuRef = useRef<HTMLDivElement>(null);
  const db = useMemo(() => new MediaDB(), []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // Wait for fade-out animation before calling parent close handler
    setTimeout(() => {
      on_close();
    }, 400);
  }, [on_close]);

  // Grand Opening Animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setVideo(initialVideo);
  }, [initialVideo]);

  // Title Card Animation & Poster Effects
  useEffect(() => {
    setPlaylistPath(video.parentPath);
    setShowTitleCard(true);
    const titleTimer = setTimeout(() => setShowTitleCard(false), 5000);

    let url: string | null = null;
    const updatePosterEffects = async () => {
        if (video.poster) {
            url = URL.createObjectURL(video.poster);
            setAmbilightUrl(url);
            try {
              const color = await getDominantColor(video.poster);
              setDominantColor(color);
            } catch (e) {
              console.warn("Could not get dominant color from poster", e);
              setDominantColor(null);
            }
        } else {
            setAmbilightUrl(null);
            setDominantColor(null);
        }
    };
    updatePosterEffects();
    
    return () => {
        clearTimeout(titleTimer);
        if (url) URL.revokeObjectURL(url);
    };
  }, [video]);

  const { playlistItems, playlistTitle } = useMemo(() => {
    const videosInPath: PlaylistItemData[] = [];
    const subfolders = new Map<string, string>(); // path -> name

    for (const v of allVideos) {
        if (v.parentPath === playlistPath) {
            videosInPath.push({ type: 'video', data: v });
        } else if (v.parentPath.startsWith(playlistPath ? `${playlistPath}/` : '')) {
            const nextSegment = v.parentPath.substring(playlistPath ? `${playlistPath}/`.length : 0).split('/')[0];
            const folderPath = playlistPath ? `${playlistPath}/${nextSegment}` : nextSegment;
            if (nextSegment) {
                subfolders.set(folderPath, nextSegment);
            }
        }
    }

    const sortedVideos = videosInPath.sort((a, b) => a.data.name.localeCompare(b.data.name, undefined, { numeric: true, sensitivity: 'base' }));
    const sortedFolders = Array.from(subfolders.entries())
        .map(([path, name]) => ({ type: 'folder' as const, data: { path, name } }))
        .sort((a, b) => a.data.name.localeCompare(b.data.name));

    let finalItems: PlaylistItemData[] = [...sortedFolders, ...sortedVideos];
    
    if (playlistPath) {
        const parentPath = playlistPath.split('/').slice(0, -1).join('/');
        finalItems.unshift({ type: 'parent', data: { path: parentPath, name: '.. Parent Directory' } });
    }
    
    if (finalItems.filter(i => i.type !== 'parent').length === 0) {
        const title = "Recommended for you";
        const otherVideos = allVideos.filter(v => v.fullPath !== video.fullPath && v.poster);
        const shuffled = otherVideos.sort(() => 0.5 - Math.random());
        const randomRecommendations = shuffled.slice(0, 20).map(v => ({ type: 'video' as const, data: v }));
        return { playlistItems: randomRecommendations, playlistTitle: title };
    }

    const title = playlistPath.split('/').pop() || 'Library Root';
    return { playlistItems: finalItems, playlistTitle: title };
  }, [allVideos, video.fullPath, playlistPath]);

  const currentPlaylistVideos = useMemo(() => {
    return playlistItems.filter(item => item.type === 'video').map(item => item.data as VideoFile);
  }, [playlistItems]);
  
  const hideControls = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      setIsControlsVisible(false);
      setIsSubtitleMenuOpen(false);
    }
  }, [isPlaying]);

  const showControls = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(hideControls, 3000);
  }, [hideControls]);

  const currentIndex = currentPlaylistVideos.findIndex(v => v.fullPath === video.fullPath);
  const hasNext = currentIndex !== -1 && currentIndex < currentPlaylistVideos.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleNext = useCallback(() => {
    if (hasNext) {
      setVideo(currentPlaylistVideos[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, currentPlaylistVideos]);
  
  // Preloading effect
  useEffect(() => {
    let nextUrl: string | null = null;
    const preloadNext = async () => {
        if (hasNext) {
            const nextVideo = currentPlaylistVideos[currentIndex + 1];
            try {
                const file = await getFileWithPermission(nextVideo.fileHandle);
                nextUrl = URL.createObjectURL(file);
                setPreloadedUrl(nextUrl);
            } catch(e) {
                console.warn("Failed to preload next video", e);
            }
        } else {
            setPreloadedUrl(null);
        }
    };
    preloadNext();
    return () => {
        if (nextUrl) URL.revokeObjectURL(nextUrl);
    }
  }, [currentIndex, currentPlaylistVideos, hasNext]);


  const handlePrevious = () => {
    if (hasPrevious) {
      setVideo(currentPlaylistVideos[currentIndex - 1]);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;
    let subtitleUrls: string[] = [];
  
    const loadVideo = async () => {
      setError(null);
      setVideoSrc(null);
      setSubtitles([]);
      setProgress(0);
      setDuration(0);
      setIsSubtitleMenuOpen(false);
      setActiveTrackLabel(null);
  
      try {
        const file = await getFileWithPermission(video.fileHandle);
        objectUrl = URL.createObjectURL(file);
        if (isMounted) {
          setVideoSrc(objectUrl);
        }
  
        const subTracks = [];
        for (const sub of video.subtitles || []) {
          try {
            const subFile = await getFileWithPermission(sub.fileHandle);
            let subContent = await subFile.text();
            if (sub.name.toLowerCase().endsWith('.srt')) {
              subContent = srtToVtt(subContent);
            }
            const subBlob = new Blob([subContent], { type: 'text/vtt' });
            const subUrl = URL.createObjectURL(subBlob);
            subtitleUrls.push(subUrl);
            subTracks.push({ src: subUrl, lang: sub.lang, label: sub.name });
          } catch (subErr) {
            console.warn(`Could not load subtitle ${sub.name}:`, subErr);
          }
        }
        if (isMounted) {
          setSubtitles(subTracks);
        }
      } catch (err: any) {
        console.error("Error loading video file:", err);
        if (isMounted) {
          setError(`Could not load video. ${err.message}. Please ensure the file has not moved and permissions are granted.`);
        }
      }
    };
  
    loadVideo();
  
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      subtitleUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [video]);

  useEffect(() => {
    showControls();
    
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    const handleClickOutside = (event: MouseEvent) => {
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(event.target as Node)) {
        setIsSubtitleMenuOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showControls]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress(videoRef.current.currentTime);
      db.updatePlaybackPosition(video.libraryId, video.fullPath, videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if(video.playbackPosition && video.playbackPosition < videoRef.current.duration - 5) {
        videoRef.current.currentTime = video.playbackPosition;
      }
      for (const track of Array.from(videoRef.current.textTracks)) {
        track.mode = 'hidden';
      }
    }
  };
  
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleVideoAreaClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlaylistOpen) {
        setIsPlaylistOpen(false);
        return;
    }
    
    if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        toggleFullscreen();
    } else {
        clickTimeoutRef.current = window.setTimeout(() => {
            togglePlay();
            clickTimeoutRef.current = null;
        }, 250);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Number(e.target.value);
      setProgress(Number(e.target.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    if(videoRef.current) {
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = useCallback(() => {
     if(videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const seek = useCallback((seconds: number) => {
    if(videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  }, []);

  const handleSelectSubtitle = (trackLabel: string | null) => {
    if (videoRef.current) {
      for (const track of Array.from(videoRef.current.textTracks)) {
        track.mode = (track.label === trackLabel) ? 'showing' : 'hidden';
      }
    }
    setActiveTrackLabel(trackLabel);
    setIsSubtitleMenuOpen(false);
  };
  
  const progressPercentage = duration > 0 ? (progress / duration) * 100 : 0;
  const volumePercentage = isMuted ? 0 : volume * 100;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') return;
      
      showControls();

      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'ArrowRight': seek(10); break;
        case 'ArrowLeft': seek(-10); break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
          }
          break;
        case 'Escape':
          if (isPlaylistOpen) setIsPlaylistOpen(false);
          else if (document.fullscreenElement) document.exitFullscreen();
          else handleClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, toggleFullscreen, toggleMute, seek, showControls, isPlaylistOpen, handleClose]);


  if (error) {
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white z-50">
            <div className="text-center p-8 max-w-lg">
                <h2 className="text-2xl font-bold text-brand-red mb-4">Playback Error</h2>
                <p className="text-gray-300 mb-6">{error}</p>
                <button
                    onClick={handleClose}
                    className="bg-brand-red text-white font-bold py-2 px-6 rounded-md hover:bg-red-700 transition-colors"
                >
                    Back to Library
                </button>
            </div>
        </div>
    );
  }

  return (
    <>
      <div className="player-ambilight-bg" style={{ backgroundImage: `url(${ambilightUrl})`, opacity: isVisible ? 1 : 0 }} />
      {preloadedUrl && <video src={preloadedUrl} preload="metadata" className="hidden" />}
      <div 
          ref={playerContainerRef} 
          className={`fixed inset-0 bg-black z-50 flex items-center justify-center player-container ${isVisible ? 'is-visible' : ''}`}
          style={{ '--player-accent-color': dominantColor } as React.CSSProperties}
          onMouseMove={showControls}
          onMouseEnter={showControls}
          onMouseLeave={hideControls}
      >
        <video
          ref={videoRef}
          src={videoSrc || ''}
          className="w-full h-full object-contain"
          autoPlay
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleNext}
          onClick={handleVideoAreaClick}
        >
          {subtitles.map(sub => (
            <track key={sub.src} kind="subtitles" srcLang={sub.lang} src={sub.src} label={sub.label} />
          ))}
        </video>
        
        {isCinematicMode && (
          <>
            <div className="letterbox-overlay top-0"></div>
            <div className="letterbox-overlay bottom-0"></div>
            <div className="film-grain-overlay"></div>
          </>
        )}

        <div className={`absolute inset-0 player-controls ${!isControlsVisible ? 'player-controls-hidden' : ''}`}>
          {/* Top Controls */}
          <div 
            className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center space-x-4 player-top-bar player-controls"
            onMouseEnter={showControls}
            onClick={e => e.stopPropagation()}
          >
              <div className="flex-1 min-w-0">
                {showTitleCard && (
                  <h2 className="text-white text-2xl font-bold truncate player-title-card">{video.name.replace(/\.[^/.]+$/, "")}</h2>
                )}
              </div>
              <button onClick={handleClose} className="text-white flex-shrink-0 player-themed-button">
                  <CloseIcon className="w-8 h-8"/>
              </button>
          </div>

          {/* Bottom Controls */}
          <div 
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent player-bottom-bar player-controls"
            onMouseEnter={showControls}
            onClick={e => e.stopPropagation()}
          >
              {/* Seek Bar */}
              <div className="flex items-center space-x-2">
                  <span className="text-white text-sm">{formatDuration(progress)}</span>
                  <input
                      type="range"
                      min="0"
                      max={duration}
                      value={progress}
                      onChange={handleSeek}
                      className="w-full h-2 bg-gray-500/50 rounded-lg appearance-none cursor-pointer range-thumb"
                      style={{ background: `linear-gradient(to right, var(--player-accent-color, var(--brand-red)) ${progressPercentage}%, rgba(128,128,128,0.5) ${progressPercentage}%)`}}
                  />
                  <span className="text-white text-sm">{formatDuration(duration)}</span>
              </div>
              {/* Buttons */}
              <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center space-x-4">
                      <button onClick={handlePrevious} disabled={!hasPrevious} className="player-themed-button">
                          <SkipPreviousIcon className="w-8 h-8"/>
                      </button>
                      <button onClick={() => seek(-10)} className="player-themed-button">
                          <Replay10Icon className="w-8 h-8"/>
                      </button>
                      <button onClick={togglePlay} className="player-themed-button">
                          {isPlaying ? <PauseIcon className="w-10 h-10"/> : <PlayIcon className="w-10 h-10"/>}
                      </button>
                      <button onClick={() => seek(10)} className="player-themed-button">
                          <Forward10Icon className="w-8 h-8"/>
                      </button>
                      <button onClick={handleNext} disabled={!hasNext} className="player-themed-button">
                          <SkipNextIcon className="w-8 h-8"/>
                      </button>
                      <div className="flex items-center space-x-2">
                          <button onClick={toggleMute} className="player-themed-button">
                              {isMuted || volume === 0 ? <VolumeOffIcon className="w-6 h-6"/> : <VolumeHighIcon className="w-6 h-6"/>}
                          </button>
                          <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={isMuted ? 0 : volume}
                              onChange={handleVolumeChange}
                              className="w-24 h-1 bg-gray-500/50 rounded-lg appearance-none cursor-pointer range-thumb-sm"
                              style={{ background: `linear-gradient(to right, var(--player-accent-color, var(--brand-red)) ${volumePercentage}%, rgba(128,128,128,0.5) ${volumePercentage}%)`}}
                          />
                      </div>
                  </div>
                  <div className="flex items-center space-x-4">
                      <button onClick={() => setIsCinematicMode(c => !c)} className={`player-themed-button ${isCinematicMode ? 'player-active-button' : ''}`} title="Cinematic Mode">
                          <FilmReelIcon className="w-7 h-7"/>
                      </button>
                      <div className="relative">
                          {subtitles.length > 0 && 
                              <button onClick={() => setIsSubtitleMenuOpen(o => !o)} className={`player-themed-button ${activeTrackLabel ? 'player-active-button' : ''}`}>
                                  <SubtitlesIcon className="w-7 h-7"/>
                              </button>
                          }
                          {isSubtitleMenuOpen && (
                              <div ref={subtitleMenuRef} className="absolute bottom-full right-0 mb-2 bg-black/80 backdrop-blur-sm rounded-md py-1 w-48 text-white">
                                  <ul>
                                      <li>
                                          <button 
                                              onClick={() => handleSelectSubtitle(null)} 
                                              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${!activeTrackLabel ? 'player-active-bg text-white' : 'hover:bg-brand-gray/50'}`}
                                          >
                                              Off
                                          </button>
                                      </li>
                                      {subtitles.map(sub => (
                                          <li key={sub.label}>
                                              <button 
                                                  onClick={() => handleSelectSubtitle(sub.label)} 
                                                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${activeTrackLabel === sub.label ? 'player-active-bg text-white' : 'hover:bg-brand-gray/50'}`}
                                              >
                                                  {getSubtitleDisplayName(sub)}
                                              </button>
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                          )}
                      </div>
                      {(allVideos.length > 1) && (
                        <button onClick={(e) => { e.stopPropagation(); setIsPlaylistOpen(o => !o); }} className={`player-themed-button ${isPlaylistOpen ? 'player-active-button' : ''}`}>
                            <PlaylistIcon className="w-7 h-7" />
                        </button>
                      )}
                      <button onClick={toggleFullscreen} className="player-themed-button">
                          {isFullscreen ? <FullscreenExitIcon className="w-7 h-7"/> : <FullscreenIcon className="w-7 h-7"/>}
                      </button>
                  </div>
              </div>
          </div>
        </div>

        <section 
          className={`absolute bottom-0 right-0 max-h-[35vh] w-full max-w-sm bg-black/80 backdrop-blur-md shadow-2xl transition-transform duration-300 ease-in-out z-10 flex flex-col ${isPlaylistOpen ? 'translate-x-0' : 'translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
            <div className="p-2 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-white truncate px-2">{playlistTitle}</h3>
                <button onClick={() => setIsPlaylistOpen(false)} className="text-gray-400 hover:text-white">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-grow min-h-0 overflow-y-auto playlist-scroll pr-1">
                <ul className="space-y-0.5 px-2 pb-2">
                    {playlistItems.map((item) => (
                        <PlaylistItem
                          key={item.type === 'video' ? item.data.fullPath : item.data.path}
                          item={item}
                          onVideoClick={setVideo}
                          onFolderClick={setPlaylistPath}
                          isActive={item.type === 'video' && item.data.fullPath === video.fullPath}
                        />
                    ))}
                </ul>
            </div>
        </section>
        
        <style>{`
          .range-thumb::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 16px;
              height: 16px;
              background: var(--player-accent-color, var(--brand-red));
              cursor: pointer;
              border-radius: 50%;
              margin-top: -6px; /* Center thumb on track */
              transition: background-color 0.2s ease;
          }
          .range-thumb-sm::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 12px;
              height: 12px;
              background: var(--player-accent-color, var(--brand-red));
              cursor: pointer;
              border-radius: 50%;
              margin-top: -5px; /* Center thumb on track */
              transition: background-color 0.2s ease;
          }
          .playlist-scroll::-webkit-scrollbar {
              width: 8px;
          }
          .playlist-scroll::-webkit-scrollbar-track {
              background: rgba(30, 30, 30, 0.5);
              border-radius: 4px;
          }
          .playlist-scroll::-webkit-scrollbar-thumb {
              background-color: #4a4a4a;
              border-radius: 4px;
              border: 2px solid transparent;
              background-clip: content-box;
          }
          .playlist-scroll::-webkit-scrollbar-thumb:hover {
              background-color: #6a6a6a;
          }
        `}</style>
      </div>
    </>
  );
};