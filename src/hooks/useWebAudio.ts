import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoaded: boolean;
  fileName: string;
  isLoadingUrl: boolean;
}

export interface AudioControls {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  loadUrl: (url: string) => Promise<void>;
  togglePlayPause: () => void;
}

export interface UseWebAudioOptions {
  initialVolume?: number;
  audioSessionType?:
    | "ambient"
    | "playback"
    | "record"
    | "play-and-record"
    | "ambient-solo";
}

export interface UseWebAudioReturn {
  state: AudioState;
  controls: AudioControls;
}

export const useWebAudio = (
  options: UseWebAudioOptions = {}
): UseWebAudioReturn => {
  const { initialVolume = 0.7, audioSessionType = "playback" } = options;

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  const [fileName, setFileName] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // Set audio session type (Safari/iOS only)
      try {
        if ("audioSession" in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (navigator as any).audioSession.type = audioSessionType;
        }
      } catch (error) {
        console.log("Audio session API not available", error);
      }

      audioContextRef.current = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();

      gainNodeRef.current = audioContextRef.current.createGain();
      analyserRef.current = audioContextRef.current.createAnalyser();

      gainNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      analyserRef.current.fftSize = 256;
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume, audioSessionType]);

  const createSource = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return null;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(gainNodeRef.current!);

    return source;
  }, []);

  const loadUrl = useCallback(
    async (url: string) => {
      if (!url.trim()) return;

      setIsLoadingUrl(true);
      initializeAudioContext();

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(
          arrayBuffer
        );

        audioBufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);

        // Extract filename from URL
        const urlParts = url.split("/");
        const filename = urlParts[urlParts.length - 1] || "Audio from URL";
        setFileName(filename);

        setIsLoaded(true);
        setCurrentTime(0);
        pauseTimeRef.current = 0;

        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
      } catch (error) {
        console.error("Error loading audio from URL:", error);
        throw new Error("Failed to load audio from URL");
      } finally {
        setIsLoadingUrl(false);
      }
    },
    [initializeAudioContext]
  );

  const play = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    const source = createSource();
    if (!source) return;

    sourceRef.current = source;
    startTimeRef.current =
      audioContextRef.current.currentTime - pauseTimeRef.current;

    source.start(0, pauseTimeRef.current);
    source.onended = () => {
      if (pauseTimeRef.current >= duration - 0.1) {
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
      }
    };

    setIsPlaying(true);
  }, [createSource, duration]);

  const pause = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      pauseTimeRef.current =
        audioContextRef.current.currentTime - startTimeRef.current;
      if (pauseTimeRef.current < 0) pauseTimeRef.current = 0;
      if (pauseTimeRef.current > duration) pauseTimeRef.current = duration;
    }

    setIsPlaying(false);
  }, [duration]);

  const seek = useCallback(
    (time: number) => {
      pauseTimeRef.current = time;
      setCurrentTime(time);

      if (isPlaying) {
        pause();
        setTimeout(play, 50);
      }
    },
    [isPlaying, pause, play]
  );

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isLoaded) return;

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isLoaded, isPlaying, pause, play]);

  // Update current time when playing
  useEffect(() => {
    if (isPlaying) {
      const updateTime = () => {
        if (audioContextRef.current && isPlaying) {
          const elapsed =
            audioContextRef.current.currentTime - startTimeRef.current;
          setCurrentTime(elapsed);

          if (elapsed >= duration) {
            setIsPlaying(false);
            setCurrentTime(0);
            pauseTimeRef.current = 0;
          }
        }
      };

      const interval = setInterval(updateTime, 100);
      return () => clearInterval(interval);
    }
  }, [isPlaying, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        } catch {
          // Source might already be stopped
        }
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    state: {
      isPlaying,
      currentTime,
      duration,
      volume,
      isLoaded,
      fileName,
      isLoadingUrl,
    },
    controls: {
      play,
      pause,
      seek,
      setVolume,
      loadUrl,
      togglePlayPause,
    },
  };
};
