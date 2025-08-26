import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VideoFile, MediaDB } from '../services/db';
import { formatDuration } from '../utils/formatters';
import { srtToVtt } from '../utils/srt2vtt';
import { getFileWithPermission } from '../utils/fileSystem';
import { LibraryInfo } from '../types';

// New, consistent, and intuitive line icon set
const PlayIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>);
const PauseIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75zm9 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>);
const VolumeHighIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>);
const VolumeOffIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>);
const Replay10Icon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M1 4v6h6"/><path strokeLinecap="round" strokeLinejoin="round" d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>);
const Forward10Icon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6"/><path strokeLinecap="round" strokeLinejoin="round" d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>);
const FullscreenIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m4.5 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>);
const FullscreenExitIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" /></svg>);
const CCIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM11 11H9.5v-0.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-0.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/>
    </svg>
);
const CloseIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const SkipPreviousIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 19.5V4.5" /></svg>);
const SkipNextIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M18 4.5v15" /></svg>);
const PlaylistIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M3 6.75a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>);
const VideoPlaceholderIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-1.66-1.34-3-3-3s-3 1.34-3 3v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V6h1v4.5c0 1.38-1.12 2.5-2.5 2.5S10 11.88 10 10.5V7c0-2.21 1.79-4 4-4s4 1.79 4 4v3.5c0 1.93-1.57 3.5-3.5 3.5S11 15.43 11 13.5V6H9.5v7.5c0 2.76 2.24 5 5 5s5-2.24 5-5V7h-1.5v3.5z"/></svg>);
const FolderIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>);
const ReturnIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7h-2z"></path></svg>);
const PipEnterIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19,11H11V17H19V11M23,19V4.97C23,3.87,22.1,3,21.03,3H2.97C1.87,3,1,3.87,1,4.97V19C1,20.1,1.87,21,2.97,21H21.03C22.1,21,23,20.1,23,19M21,19H3V4.97H21V19Z"/></svg>);
const PipExitIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19,19H5V5H12V7H7V17H17V12H19V19M19,3H13V5H15.59L12,8.59L13.41,10L17,6.41V9H19V3Z" /></svg>);


interface PlayerProps {
  video: VideoFile;
  on_close: () => void;
  allVideos: VideoFile[];
  activeLibrary: LibraryInfo;
  playlist?: VideoFile[] | null;
  onSwitchVideo: (video: VideoFile) => void;
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
    isFocused: boolean;
}> = ({ item, onVideoClick, onFolderClick, isActive, isFocused }) => {
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const itemRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        if (isFocused && itemRef.current) {
            itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [isFocused]);
    
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

    const commonButtonClasses = "w-full text-left p-0.5 rounded-md transition-colors flex items-center space-x-1 outline-none";
    const focusClasses = isFocused ? 'ring-2 ring-brand-red ring-inset' : '';

    if (item.type === 'folder' || item.type === 'parent') {
        const folder = item.data;
        const Icon = item.type === 'folder' ? FolderIcon : ReturnIcon;
        return (
             <li ref={itemRef}>
                <button onClick={() => onFolderClick(folder.path)} className={`${commonButtonClasses} hover:bg-brand-gray ${focusClasses}`}>
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
        <li ref={itemRef}>
            <button
                onClick={() => onVideoClick(video)}
                className={`${commonButtonClasses} ${isActive ? 'player-active-bg-light' : 'hover:bg-brand-gray'} ${focusClasses}`}
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

export const Player: React.FC<PlayerProps> = ({ video, on_close, allVideos, playlist, onSwitchVideo }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<{ src: string; lang: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSubtitleMenuOpen, setIsSubtitleMenuOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [activeTrackLabel, setActiveTrackLabel] = useState<string | null>(null);
  const [playlistPath, setPlaylistPath] = useState(video.parentPath);
  const [isVisible, setIsVisible] = useState(false);
  const [focusedPlaylistItemIndex, setFocusedPlaylistItemIndex] = useState(-1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const subtitleMenuRef = useRef<HTMLDivElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const playlistRef = useRef<HTMLUListElement>(null);
  const db = useMemo(() => new MediaDB(), []);

  const isPipSupported = useMemo(() => 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => on_close(), 400);
  }, [on_close]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!playlist) {
      setPlaylistPath(video.parentPath);
    }
  }, [video, playlist]);
  
  useEffect(() => {
      setFocusedPlaylistItemIndex(-1);
  }, [isPlaylistOpen, playlistPath]);

  const { playlistItems, playlistTitle } = useMemo(() => {
    if (playlist) {
      return {
        playlistItems: playlist.map(v => ({ type: 'video' as const, data: v })),
        playlistTitle: 'Remix Playlist'
      };
    }

    const videosInPath: PlaylistItemData[] = [];
    const subfolders = new Map<string, string>();

    for (const v of allVideos) {
        if (v.parentPath === playlistPath) {
            videosInPath.push({ type: 'video', data: v });
        } else if (v.parentPath.startsWith(playlistPath ? `${playlistPath}/` : '')) {
            const nextSegment = v.parentPath.substring(playlistPath ? `${playlistPath}/`.length : 0).split('/')[0];
            const folderPath = playlistPath ? `${playlistPath}/${nextSegment}` : nextSegment;
            if (nextSegment) subfolders.set(folderPath, nextSegment);
        }
    }

    const sortedVideos = videosInPath.sort((a, b) => a.data.name.localeCompare(b.data.name, undefined, { numeric: true, sensitivity: 'base' }));
    const sortedFolders: PlaylistItemData[] = Array.from(subfolders.entries())
        .map(([path, name]) => ({ type: 'folder' as const, data: { path, name } }))
        .sort((a, b) => a.data.name.localeCompare(b.data.name));
    
    const parentFolderItem: PlaylistItemData[] = [];
    if (playlistPath) {
        const parts = playlistPath.split('/');
        const parentPath = parts.slice(0, -1).join('/');
        parentFolderItem.push({ type: 'parent', data: { path: parentPath, name: '.. Go Up' } });
    }

    return {
        playlistItems: [...parentFolderItem, ...sortedFolders, ...sortedVideos],
        playlistTitle: playlistPath.split('/').pop() || 'Root'
    };
  }, [allVideos, playlistPath, playlist]);

  const handleSwitchVideo = useCallback((newVideo: VideoFile) => {
    if (newVideo.fullPath !== video.fullPath) {
        onSwitchVideo(newVideo);
    }
  }, [onSwitchVideo, video.fullPath]);

  const currentVideoIndex = useMemo(() => {
    const currentPlaylist = playlist || allVideos.filter(v => v.parentPath === video.parentPath);
    return currentPlaylist.findIndex(v => v.fullPath === video.fullPath);
  }, [playlist, allVideos, video]);

  const handleSkip = useCallback((direction: 'next' | 'prev') => {
    const currentPlaylist = playlist || allVideos.filter(v => v.parentPath === video.parentPath).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (currentPlaylist.length > 1) {
        let nextIndex = currentVideoIndex + (direction === 'next' ? 1 : -1);
        if (nextIndex >= currentPlaylist.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = currentPlaylist.length - 1;
        
        handleSwitchVideo(currentPlaylist[nextIndex]);
    }
  }, [currentVideoIndex, playlist, allVideos, video, handleSwitchVideo]);

  useEffect(() => {
    let videoObjectUrl: string | null = null;
    let subtitleObjectUrls: string[] = [];
    const loadMedia = async () => {
      try {
        setError(null); setVideoSrc(null); setSubtitles([]);
        const videoFile = await getFileWithPermission(video.fileHandle);
        videoObjectUrl = URL.createObjectURL(videoFile);
        setVideoSrc(videoObjectUrl);
        const subtitlePromises = video.subtitles.map(async (sub) => {
          try {
            const subFile = await getFileWithPermission(sub.fileHandle);
            const text = await subFile.text();
            const vttContent = subFile.name.toLowerCase().endsWith('.srt') ? srtToVtt(text) : text;
            const blob = new Blob([vttContent], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            subtitleObjectUrls.push(url);
            return { src: url, lang: sub.lang, label: sub.name };
          } catch (e) { return null; }
        });
        const resolvedSubtitles = (await Promise.all(subtitlePromises)).filter(Boolean) as { src: string; lang: string; label: string }[];
        setSubtitles(resolvedSubtitles);
      } catch (err: any) {
        setError(`Failed to load video: ${err.message}. Please check file permissions.`);
        setIsPlaying(false);
      }
    };
    loadMedia();
    return () => {
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
      subtitleObjectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [video]);
  
  const handleProgress = () => {
    if (!videoRef.current) return;
    const videoNode = videoRef.current;
    if (videoNode.buffered.length > 0) {
      const bufferedEnd = videoNode.buffered.end(videoNode.buffered.length - 1);
      setBuffered(bufferedEnd);
    }
  };
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress(videoRef.current.currentTime);
      db.updatePlaybackPosition(video.libraryId, video.fullPath, videoRef.current.currentTime);
    }
  };
  
  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (video.playbackPosition) videoRef.current.currentTime = video.playbackPosition;
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  }, []);
  
  const showControls = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setIsControlsVisible(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    showControls();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [showControls, isPlaying]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.player-bottom-bar, .player-top-bar')) {
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
  }, [togglePlay, toggleFullscreen]);
  
  useEffect(() => () => { if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current) }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = Number(e.target.value);
      videoRef.current.currentTime = time;
      setProgress(time);
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newVolume = Number(e.target.value);
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      if (!newMutedState && volume === 0) {
        setVolume(0.5); videoRef.current.volume = 0.5;
      }
    }
  }, [isMuted, volume]);
  
  const togglePip = async () => {
    if (!videoRef.current) return;
    try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await videoRef.current.requestPictureInPicture();
    } catch (error) { console.error("PiP error:", error); }
  };
  
  const handleSubtitleChange = (label: string | null) => {
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = tracks[i].label === label ? 'showing' : 'hidden';
      }
      setActiveTrackLabel(label);
    }
    setIsSubtitleMenuOpen(false);
  };
  
  const handleCustomSubtitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
        const url = URL.createObjectURL(file);
        const track = document.createElement('track');
        track.src = url; track.kind = 'subtitles'; track.srclang = 'custom'; track.label = file.name; track.default = true;
        videoRef.current.appendChild(track);
        setTimeout(() => {
            const newTracks = videoRef.current?.textTracks;
            if (newTracks) {
                for(let i = 0; i < newTracks.length; i++) newTracks[i].mode = 'hidden';
                const newTrack = Array.from(newTracks).find(t => t.label === file.name);
                if (newTrack) { newTrack.mode = 'showing'; setActiveTrackLabel(file.name); }
            }
        }, 100);
        setIsSubtitleMenuOpen(false);
    }
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (isPlaylistOpen) {
          e.preventDefault();
          switch (e.key) {
            case 'ArrowUp':
              setFocusedPlaylistItemIndex(prev => (prev <= 0 ? playlistItems.length - 1 : prev - 1));
              break;
            case 'ArrowDown':
              setFocusedPlaylistItemIndex(prev => (prev >= playlistItems.length - 1 ? 0 : prev + 1));
              break;
            case 'Enter':
              if (focusedPlaylistItemIndex > -1 && playlistItems[focusedPlaylistItemIndex]) {
                const item = playlistItems[focusedPlaylistItemIndex];
                if (item.type === 'video') handleSwitchVideo(item.data);
                else setPlaylistPath(item.data.path);
              }
              break;
            case 'Escape':
              setIsPlaylistOpen(false);
              break;
          }
          return;
      }
      
      switch(e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'ArrowRight': e.preventDefault(); if (videoRef.current) videoRef.current.currentTime += 10; break;
        case 'ArrowLeft': e.preventDefault(); if (videoRef.current) videoRef.current.currentTime -= 10; break;
        case 'Escape': e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else handleClose(); break;
        case 'n': e.preventDefault(); handleSkip('next'); break;
        case 'p': e.preventDefault(); handleSkip('prev'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, handleClose, handleSkip, isPlaylistOpen, playlistItems, focusedPlaylistItemIndex, handleSwitchVideo]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  useEffect(() => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const handlePipChange = () => setIsPip(!!document.pictureInPictureElement);
      videoEl.addEventListener('enterpictureinpicture', handlePipChange);
      videoEl.addEventListener('leavepictureinpicture', handlePipChange);
      return () => {
          videoEl.removeEventListener('enterpictureinpicture', handlePipChange);
          videoEl.removeEventListener('leavepictureinpicture', handlePipChange);
      };
  }, []);
  
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(event.target as Node)) {
              setIsSubtitleMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
        ref={playerContainerRef}
        className={`fixed inset-0 bg-black z-50 flex items-center justify-center player-container ${isVisible ? 'is-visible' : ''}`}
        onMouseMove={showControls}
        onMouseLeave={() => isPlaying && setIsControlsVisible(false)}
    >
      <div className="absolute inset-0 w-full h-full" onClick={handleClick}>
        {videoSrc && !error ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onProgress={handleProgress}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => handleSkip('next')}
            className="w-full h-full object-contain"
          >
            {subtitles.map(sub => <track key={sub.label} kind="subtitles" srcLang={sub.lang} src={sub.src} label={sub.label} />)}
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {error ? <p className="text-red-400 max-w-lg text-center">{error}</p> : <div className="text-xl animate-pulse">Loading media...</div>}
          </div>
        )}
      </div>

      <div className={`absolute inset-0 player-controls pointer-events-none ${isControlsVisible ? '' : 'player-controls-hidden'}`}>
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 flex justify-between items-center player-top-bar pointer-events-auto">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white">{video.name.replace(/\.[^/.]+$/, "")}</h2>
            <p className="text-sm text-gray-300">{video.parentPath}</p>
          </div>
          <button onClick={handleClose} className="player-themed-button">
            <CloseIcon className="w-8 h-8"/>
          </button>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 player-bottom-bar pointer-events-auto">
          <div className="flex items-center space-x-4 mb-2">
            <span className="text-white text-sm font-mono">{formatDuration(progress)}</span>
            <div className="relative w-full h-4 flex items-center group">
                <div className="absolute w-full h-1.5 bg-white/20 rounded-lg">
                    <div className="absolute h-full bg-white/40 rounded-lg" style={{ width: `${(buffered / duration) * 100}%` }}></div>
                    <div className="absolute h-full player-active-bg rounded-lg" style={{ width: `${(progress / duration) * 100}%` }}></div>
                </div>
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={progress || 0}
                    onChange={handleSeek}
                    className="w-full bg-transparent appearance-none cursor-pointer range-thumb"
                />
            </div>
            <span className="text-white text-sm font-mono">{formatDuration(duration)}</span>
          </div>
        
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={() => handleSkip('prev')} className="player-themed-button" disabled={currentVideoIndex === -1}><SkipPreviousIcon className="w-6 h-6"/></button>
              <button onClick={togglePlay} className="player-themed-button">{isPlaying ? <PauseIcon className="w-8 h-8"/> : <PlayIcon className="w-8 h-8"/>}</button>
              <button onClick={() => handleSkip('next')} className="player-themed-button" disabled={currentVideoIndex === -1}><SkipNextIcon className="w-6 h-6"/></button>
              <div className="flex items-center space-x-2">
                <button onClick={toggleMute} className="player-themed-button">
                  {isMuted || volume === 0 ? <VolumeOffIcon className="w-6 h-6"/> : <VolumeHighIcon className="w-6 h-6"/>}
                </button>
                <div className="relative w-24 h-4 flex items-center group">
                    <div className="absolute w-full h-1 bg-white/20 rounded-lg">
                        <div className="absolute h-full player-active-bg rounded-lg" style={{ width: `${isMuted ? 0 : volume * 100}%` }}></div>
                    </div>
                    <input
                      type="range"
                      min="0" max="1" step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-full bg-transparent appearance-none cursor-pointer range-thumb-sm"
                    />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
               {isPipSupported && (
                 <button onClick={togglePip} className={`player-themed-button ${isPip ? 'player-active-button': ''}`} title={isPip ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}>
                   {isPip ? <PipExitIcon className="w-6 h-6"/> : <PipEnterIcon className="w-6 h-6"/>}
                 </button>
               )}
               <button onClick={() => setIsPlaylistOpen(p => !p)} className={`player-themed-button ${isPlaylistOpen ? 'player-active-button' : ''}`} title="Playlist">
                <PlaylistIcon className="w-6 h-6"/>
               </button>
               <div className="relative flex items-center" ref={subtitleMenuRef}>
                 <button onClick={() => setIsSubtitleMenuOpen(p => !p)} className={`player-themed-button ${activeTrackLabel ? 'player-active-button' : ''}`} title="Subtitles">
                   <CCIcon className="w-6 h-6"/>
                 </button>
                 {isSubtitleMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-56 bg-brand-black/80 backdrop-blur-sm rounded-md shadow-lg py-1 text-white">
                        <a href="#" onClick={(e) => { e.preventDefault(); handleSubtitleChange(null); }} className="block px-4 py-2 text-sm hover:player-active-bg-light">Off</a>
                        {subtitles.map(sub => (
                           <a key={sub.label} href="#" onClick={(e) => { e.preventDefault(); handleSubtitleChange(sub.label); }} className={`block px-4 py-2 text-sm hover:player-active-bg-light ${activeTrackLabel === sub.label ? 'player-active-bg' : ''}`}>{getSubtitleDisplayName(sub)}</a>
                        ))}
                        <div className="border-t border-brand-gray/50 my-1"></div>
                        <label className="block px-4 py-2 text-sm hover:player-active-bg-light cursor-pointer">
                            Load custom...
                            <input type="file" accept=".vtt,.srt" ref={subtitleInputRef} onChange={handleCustomSubtitle} className="hidden" />
                        </label>
                    </div>
                 )}
               </div>
               <button onClick={toggleFullscreen} className="player-themed-button" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                 {isFullscreen ? <FullscreenExitIcon className="w-6 h-6"/> : <FullscreenIcon className="w-6 h-6"/>}
               </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-24 right-4 w-96 max-w-[90vw] bg-black/70 backdrop-blur-md rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: isPlaylistOpen ? '60vh' : '0' }}>
          <div className="p-2 flex flex-col h-full">
              <div className="flex justify-between items-center mb-2 px-2 flex-shrink-0">
                <h3 className="font-bold text-lg">{playlistTitle}</h3>
                <button onClick={() => setIsPlaylistOpen(false)} className="player-themed-button">
                    <CloseIcon className="w-6 h-6"/>
                </button>
              </div>
              <ul ref={playlistRef} className="space-y-1 p-2 overflow-y-auto flex-grow" style={{ maxHeight: 'calc(60vh - 4rem)' }}>
                  {playlistItems.map((item, index) => (
                      <PlaylistItem
                          key={item.type === 'video' ? item.data.fullPath : item.data.path}
                          item={item}
                          onVideoClick={handleSwitchVideo}
                          onFolderClick={setPlaylistPath}
                          isActive={item.type === 'video' && item.data.fullPath === video.fullPath}
                          isFocused={index === focusedPlaylistItemIndex}
                      />
                  ))}
              </ul>
          </div>
      </div>
    </div>
  );
};