import { useState, useRef, useEffect, useCallback } from "react";
import "./MusicPlayer.css";

export const MusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [fileName, setFileName] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
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
  }, [volume]);

  const loadAudioFile = useCallback(
    async (file: File) => {
      initializeAudioContext();

      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(
          arrayBuffer
        );

        audioBufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);
        setFileName(file.name);
        setIsLoaded(true);
        setCurrentTime(0);
        pauseTimeRef.current = 0;

        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
      } catch (error) {
        console.error("Error loading audio file:", error);
      }
    },
    [initializeAudioContext]
  );

  const createSource = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return null;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(gainNodeRef.current!);

    return source;
  }, []);

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

  const updateVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    }
  }, []);

  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyserRef.current.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#ff6b6b");
    gradient.addColorStop(0.5, "#4ecdc4");
    gradient.addColorStop(1, "#45b7d1");

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawVisualizer);
    }
  }, [isPlaying]);

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
      drawVisualizer();

      return () => {
        clearInterval(interval);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isPlaying, duration, drawVisualizer]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadAudioFile(file);
    }
  };

  const togglePlayPause = () => {
    if (!isLoaded) return;

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <div className="music-player">
      <div className="player-header">
        <h2>Web Audio Music Player</h2>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="file-input"
        />
      </div>

      <div className="visualizer-container">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="visualizer"
        />
      </div>

      <div className="track-info">
        <div className="track-name">{fileName || "No track loaded"}</div>
        <div className="time-info">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="progress-container">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          className="progress-slider"
          disabled={!isLoaded}
        />
      </div>

      <div className="controls">
        <button
          onClick={togglePlayPause}
          className={`play-pause-btn ${!isLoaded ? "disabled" : ""}`}
          disabled={!isLoaded}
        >
          {isPlaying ? "⏸️" : "▶️"}
        </button>
      </div>

      <div className="volume-container">
        <span>🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => updateVolume(Number(e.target.value))}
          className="volume-slider"
        />
        <span>{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
};
