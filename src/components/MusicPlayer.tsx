import { useState } from "react";
import { useWebAudio } from "../hooks/useWebAudio";
import "./MusicPlayer.css";

export const MusicPlayer: React.FC = () => {
  const { state, controls } = useWebAudio({
    initialVolume: 0.7,
    audioSessionType: "play-and-record",
  });

  const [audioUrl, setAudioUrl] = useState<string>(
    "https://d1hmbp8rqc9pi0.cloudfront.net/music/barbara-waters.mp3"
  );

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleUrlSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (audioUrl.trim()) {
      controls.loadUrl(audioUrl.trim()).catch((error) => {
        console.error("Failed to load URL:", error);
        alert(
          "Failed to load audio from URL. Please check the URL and try again."
        );
      });
    }
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAudioUrl(event.target.value);
  };

  return (
    <div className="music-player">
      <div className="player-header">
        <h2>Web Audio Music Player</h2>

        <div className="input-section">
          <form onSubmit={handleUrlSubmit} className="url-input-container">
            <label htmlFor="url-input" className="input-label">
              Load from URL:
            </label>
            <div className="url-input-group">
              <input
                id="url-input"
                type="url"
                value={audioUrl}
                onChange={handleUrlChange}
                placeholder="https://example.com/audio.mp3"
                className="url-input"
                disabled={state.isLoadingUrl}
              />
              <button
                type="submit"
                className="url-submit-btn"
                disabled={state.isLoadingUrl || !audioUrl.trim()}
              >
                {state.isLoadingUrl ? "Loading..." : "Load"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="track-info">
        <div className="track-name">{state.fileName || "No track loaded"}</div>
        <div className="time-info">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>

      <div className="progress-container">
        <input
          type="range"
          min="0"
          max={state.duration}
          value={state.currentTime}
          onChange={(e) => controls.seek(Number(e.target.value))}
          className="progress-slider"
          disabled={!state.isLoaded}
        />
      </div>

      <div className="controls">
        <button
          onClick={controls.togglePlayPause}
          className={`play-pause-btn ${!state.isLoaded ? "disabled" : ""}`}
          disabled={!state.isLoaded}
        >
          {state.isPlaying ? "⏸️" : "▶️"}
        </button>
      </div>

      <div className="volume-container">
        <span>🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state.volume}
          onChange={(e) => controls.setVolume(Number(e.target.value))}
          className="volume-slider"
        />
        <span>{Math.round(state.volume * 100)}%</span>
      </div>
    </div>
  );
};
