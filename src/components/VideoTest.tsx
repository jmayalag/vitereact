import { Slider } from "@/components/ui/slider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ResizeMode = "none" | "crop-and-scale";

type TrackCapabilities = MediaTrackCapabilities & {
  focusDistance: ULongRange;
  zoom: ULongRange;
};

export function VideoTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameras, setCameras] = useState<
    Array<{ deviceId: string; label: string; groupId: string }>
  >([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [supportedConstraints, setSupportedConstraints] =
    useState<MediaTrackSupportedConstraints | null>(null);
  const [trackCapabilities, setTrackCapabilities] =
    useState<TrackCapabilities | null>(null);
  const [trackConstraints, setTrackConstraints] =
    useState<MediaTrackConstraints | null>(null);
  const [trackSettings, setTrackSettings] = useState<MediaTrackSettings | null>(
    null
  );
  const [constraintForm, setConstraintForm] = useState<{
    width: string;
    height: string;
    aspectRatio: string;
    resizeMode: string;
    zoom: number[];
    focusDistance: number[];
  }>({
    width: "",
    height: "",
    aspectRatio: "",
    resizeMode: "",
    zoom: [1],
    focusDistance: [0],
  });

  const orientation = useMemo(() => {
    if (!trackSettings?.aspectRatio) return "";
    if (trackSettings.aspectRatio === 1) return "Square";
    if (trackSettings.aspectRatio < 1 && trackSettings.aspectRatio > 0)
      return "Portrait";
    return "Landscape";
  }, [trackSettings?.aspectRatio]);

  const startCamera = async (cameraId?: string) => {
    try {
      setError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          ...(cameraId
            ? { deviceId: { exact: cameraId } }
            : { facingMode: "user" }),
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setStream(mediaStream);
      setIsStreaming(true);
      await enumerateCameras();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to access camera";
      setError(errorMessage);
      console.error("Error accessing camera:", err);
    }
  };

  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          groupId: device.groupId,
        }));

      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating cameras:", err);
    }
  }, [selectedCameraId]);

  const switchCamera = async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    if (isStreaming) {
      await startCamera(cameraId);
    }
  };

  const refreshTrackInfo = useCallback(() => {
    try {
      const videoTrack = stream?.getVideoTracks()[0];
      if (!videoTrack) {
        setTrackCapabilities(null);
        setTrackConstraints(null);
        setTrackSettings(null);
        return;
      }

      const anyTrack = videoTrack as unknown as {
        getCapabilities?: () => MediaTrackCapabilities;
      };
      if (typeof anyTrack.getCapabilities === "function") {
        setTrackCapabilities(anyTrack.getCapabilities() as TrackCapabilities);
      } else {
        setTrackCapabilities(null);
      }

      if (typeof videoTrack.getConstraints === "function") {
        setTrackConstraints(videoTrack.getConstraints());
      } else {
        setTrackConstraints(null);
      }

      if (typeof videoTrack.getSettings === "function") {
        setTrackSettings(videoTrack.getSettings());
      } else {
        setTrackSettings(null);
      }
    } catch (err) {
      console.error("Error refreshing track info:", err);
    }
  }, [stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsStreaming(false);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current && isStreaming) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        const imageUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `snapshot-${Date.now()}.png`;
        link.href = imageUrl;
        link.click();
      }
    }
  };

  const applyCustomConstraints = useCallback(async () => {
    try {
      const videoTrack = stream?.getVideoTracks()[0];
      if (!videoTrack) return;

      const constraints: MediaTrackConstraints & { resizeMode?: ResizeMode } =
        {};
      if (constraintForm.width.trim() !== "") {
        const value = Number(constraintForm.width);
        if (!Number.isNaN(value) && value > 0)
          constraints.width = { ideal: value };
      }
      if (constraintForm.height.trim() !== "") {
        const value = Number(constraintForm.height);
        if (!Number.isNaN(value) && value > 0)
          constraints.height = { ideal: value };
      }
      if (constraintForm.aspectRatio.trim() !== "") {
        const value = Number(constraintForm.aspectRatio);
        if (!Number.isNaN(value) && value > 0)
          constraints.aspectRatio = { ideal: value };
      }
      if (constraintForm.resizeMode.trim() !== "") {
        constraints.resizeMode = constraintForm.resizeMode as ResizeMode;
      }
      if (trackCapabilities?.zoom && constraintForm.zoom[0] !== undefined) {
        (
          constraints as MediaTrackConstraints & { zoom?: ConstrainDouble }
        ).zoom = { ideal: constraintForm.zoom[0] };
      }
      if (
        trackCapabilities?.focusDistance &&
        constraintForm.focusDistance[0] !== undefined
      ) {
        (
          constraints as MediaTrackConstraints & {
            focusDistance?: ConstrainDouble;
          }
        ).focusDistance = { ideal: constraintForm.focusDistance[0] };
      }

      if (Object.keys(constraints).length === 0) return;

      await videoTrack.applyConstraints(constraints);
      refreshTrackInfo();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to apply constraints";
      setError(message);
      console.error("applyConstraints error:", err);
    }
  }, [
    constraintForm,
    stream,
    refreshTrackInfo,
    trackCapabilities?.zoom,
    trackCapabilities?.focusDistance,
  ]);

  const applyZoomConstraint = useCallback(
    async (zoomValue: number) => {
      try {
        const videoTrack = stream?.getVideoTracks()[0];
        if (!videoTrack || !trackCapabilities?.zoom) return;

        await videoTrack.applyConstraints({
          zoom: { ideal: zoomValue },
        } as MediaTrackConstraints & { zoom?: ConstrainDouble });
        refreshTrackInfo();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to apply zoom constraint";
        setError(message);
        console.error("applyZoomConstraint error:", err);
      }
    },
    [stream, trackCapabilities?.zoom, refreshTrackInfo]
  );

  const applyFocusConstraint = useCallback(
    async (focusValue: number) => {
      try {
        const videoTrack = stream?.getVideoTracks()[0];
        if (!videoTrack || !trackCapabilities?.focusDistance) return;

        await videoTrack.applyConstraints({
          focusDistance: { ideal: focusValue },
        } as MediaTrackConstraints & { focusDistance?: ConstrainDouble });
        refreshTrackInfo();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to apply focus constraint";
        setError(message);
        console.error("applyFocusConstraint error:", err);
      }
    },
    [stream, trackCapabilities?.focusDistance, refreshTrackInfo]
  );

  const setPortraitPreset = () => {
    setConstraintForm({
      width: "1080",
      height: "1920",
      aspectRatio: (9 / 16).toString(),
      resizeMode: "",
      zoom: constraintForm.zoom,
      focusDistance: constraintForm.focusDistance,
    });
  };

  const setLandscapePreset = () => {
    setConstraintForm({
      width: "1920",
      height: "1080",
      aspectRatio: (16 / 9).toString(),
      resizeMode: "",
      zoom: constraintForm.zoom,
      focusDistance: constraintForm.focusDistance,
    });
  };

  const resetConstraintForm = () => {
    setConstraintForm({
      width: "",
      height: "",
      aspectRatio: "",
      resizeMode: "",
      zoom: trackCapabilities?.zoom ? [trackCapabilities.zoom.min ?? 1] : [1],
      focusDistance: trackCapabilities?.focusDistance
        ? [trackCapabilities.focusDistance.min ?? 0]
        : [0],
    });
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    enumerateCameras();
  }, [enumerateCameras]);

  useEffect(() => {
    setSupportedConstraints(navigator.mediaDevices.getSupportedConstraints());
  }, []);

  useEffect(() => {
    refreshTrackInfo();
  }, [stream, refreshTrackInfo]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="rounded-lg shadow-md max-w-full h-auto max-h-[400px] md:max-h-[600px]"
                style={{ transform: "scaleX(-1)" }}
              />
              {!isStreaming && (
                <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p>Camera preview will appear here</p>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full select-none space-y-2">
              {trackCapabilities?.zoom && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zoom ({trackCapabilities.zoom.min} -{" "}
                    {trackCapabilities.zoom.max})
                  </label>
                  <div className="space-y-2">
                    <Slider
                      value={constraintForm.zoom}
                      onValueChange={(value) => {
                        setConstraintForm((f) => ({
                          ...f,
                          zoom: value,
                        }));
                      }}
                      onValueCommit={(value) => {
                        applyZoomConstraint(value[0]);
                      }}
                      min={trackCapabilities.zoom.min}
                      max={trackCapabilities.zoom.max}
                      step={0.1}
                      disabled={!isStreaming}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 text-center">
                      Current: {constraintForm.zoom[0]}
                    </div>
                  </div>
                </div>
              )}
              {trackCapabilities?.focusDistance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Focus Distance ({trackCapabilities.focusDistance.min} -{" "}
                    {trackCapabilities.focusDistance.max})
                  </label>
                  <div className="space-y-2">
                    <Slider
                      value={constraintForm.focusDistance}
                      onValueChange={(value) => {
                        setConstraintForm((f) => ({
                          ...f,
                          focusDistance: value,
                        }));
                      }}
                      onValueCommit={(value) => {
                        applyFocusConstraint(value[0]);
                      }}
                      min={trackCapabilities.focusDistance.min}
                      max={trackCapabilities.focusDistance.max}
                      step={0.01}
                      disabled={!isStreaming}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 text-center">
                      Current: {constraintForm.focusDistance[0]}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {cameras.length > 0 && (
              <div className="w-full max-w-md">
                <label
                  htmlFor="camera-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Select Camera
                </label>
                <select
                  id="camera-select"
                  value={selectedCameraId}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {cameras.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg w-full">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="flex flex-wrap gap-4 justify-center">
              {!isStreaming ? (
                <button
                  onClick={() => startCamera(selectedCameraId || undefined)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Start Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={stopCamera}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                  >
                    Stop Camera
                  </button>
                  <button
                    onClick={takeSnapshot}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                  >
                    Take Snapshot
                  </button>
                </>
              )}
            </div>

            <div className="w-full mt-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Custom Constraints
              </h2>
              <p>{orientation}</p>
              <div className="mb-4">
                <h3 className="text-md font-medium text-gray-700 mb-2">
                  Presets
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={setPortraitPreset}
                    disabled={!isStreaming}
                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Portrait (9:16)
                  </button>
                  <button
                    onClick={setLandscapePreset}
                    disabled={!isStreaming}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Landscape (16:9)
                  </button>
                  <button
                    onClick={resetConstraintForm}
                    className="bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={
                      trackCapabilities?.width
                        ? `${trackCapabilities.width.min} - ${trackCapabilities.width.max}`
                        : "e.g. 1920"
                    }
                    value={constraintForm.width}
                    onChange={(e) =>
                      setConstraintForm((f) => ({
                        ...f,
                        width: e.target.value,
                      }))
                    }
                    disabled={!isStreaming}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={
                      trackCapabilities?.height
                        ? `${trackCapabilities.height.min} - ${trackCapabilities.height.max}`
                        : "e.g. 1080"
                    }
                    value={constraintForm.height}
                    onChange={(e) =>
                      setConstraintForm((f) => ({
                        ...f,
                        height: e.target.value,
                      }))
                    }
                    disabled={!isStreaming}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aspect ratio (w/h)
                  </label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder={
                      trackCapabilities?.aspectRatio
                        ? `${trackCapabilities.aspectRatio.min} - ${trackCapabilities.aspectRatio.max}`
                        : "e.g. 1.7778"
                    }
                    value={constraintForm.aspectRatio}
                    onChange={(e) =>
                      setConstraintForm((f) => ({
                        ...f,
                        aspectRatio: e.target.value,
                      }))
                    }
                    disabled={!isStreaming}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resize mode
                  </label>
                  <select
                    value={constraintForm.resizeMode}
                    onChange={(e) =>
                      setConstraintForm((f) => ({
                        ...f,
                        resizeMode: e.target.value,
                      }))
                    }
                    disabled={!isStreaming}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="">(leave unchanged)</option>
                    {(
                      trackCapabilities as unknown as {
                        resizeMode?: ResizeMode[];
                      } | null
                    )?.resizeMode?.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                    {!(
                      trackCapabilities as unknown as {
                        resizeMode?: ResizeMode[];
                      } | null
                    )?.resizeMode && (
                      <>
                        <option value="none">none</option>
                        <option value="crop-and-scale">crop-and-scale</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={applyCustomConstraints}
                  disabled={!isStreaming}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={resetConstraintForm}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Reset fields
                </button>
              </div>
            </div>

            <div className="w-full mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Constraints & Capabilities
                </h2>
                <button
                  onClick={refreshTrackInfo}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium py-1.5 px-3 rounded-md transition-colors"
                >
                  Refresh info
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">
                    Supported Constraints
                  </h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(supportedConstraints, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">
                    Track Capabilities
                  </h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(trackCapabilities, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">
                    Track Settings
                  </h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(trackSettings, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">
                    Applied Constraints
                  </h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(trackConstraints, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
