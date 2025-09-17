import { useCallback, useEffect, useRef, useState } from 'react'

export function VideoTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [cameras, setCameras] = useState<Array<{ deviceId: string; label: string; groupId: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [supportedConstraints, setSupportedConstraints] = useState<MediaTrackSupportedConstraints | null>(null)
  const [trackCapabilities, setTrackCapabilities] = useState<MediaTrackCapabilities | null>(null)
  const [trackConstraints, setTrackConstraints] = useState<MediaTrackConstraints | null>(null)
  const [trackSettings, setTrackSettings] = useState<MediaTrackSettings | null>(null)

  const startCamera = async (cameraId?: string) => {
    try {
      setError(null)
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'user' })
        },
        audio: false
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      
      setStream(mediaStream)
      setIsStreaming(true)
      await enumerateCameras()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'
      setError(errorMessage)
      console.error('Error accessing camera:', err)
    }
  }

  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          groupId: device.groupId
        }))

      setCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
    } catch (err) {
      console.error('Error enumerating cameras:', err)
    }
  }, [selectedCameraId])

  const switchCamera = async (cameraId: string) => {
    setSelectedCameraId(cameraId)
    if (isStreaming) {
      await startCamera(cameraId)
    }
  }

  const refreshTrackInfo = useCallback(() => {
    try {
      const videoTrack = stream?.getVideoTracks()[0]
      if (!videoTrack) {
        setTrackCapabilities(null)
        setTrackConstraints(null)
        setTrackSettings(null)
        return
      }

      const anyTrack = videoTrack as unknown as { getCapabilities?: () => MediaTrackCapabilities }
      if (typeof anyTrack.getCapabilities === 'function') {
        setTrackCapabilities(anyTrack.getCapabilities())
      } else {
        setTrackCapabilities(null)
      }

      if (typeof videoTrack.getConstraints === 'function') {
        setTrackConstraints(videoTrack.getConstraints())
      } else {
        setTrackConstraints(null)
      }

      if (typeof videoTrack.getSettings === 'function') {
        setTrackSettings(videoTrack.getSettings())
      } else {
        setTrackSettings(null)
      }
    } catch (err) {
      console.error('Error refreshing track info:', err)
    }
  }, [stream])

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
      setIsStreaming(false)
      
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }

  const takeSnapshot = () => {
    if (videoRef.current && isStreaming) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (context) {
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)
        
        const imageUrl = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = `snapshot-${Date.now()}.png`
        link.href = imageUrl
        link.click()
      }
    }
  }

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  useEffect(() => {
    enumerateCameras()
  }, [enumerateCameras])

  useEffect(() => {
    setSupportedConstraints(navigator.mediaDevices.getSupportedConstraints())
  }, [])

  useEffect(() => {
    refreshTrackInfo()
  }, [stream, refreshTrackInfo])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Camera Test
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="rounded-lg shadow-md max-w-full h-auto"
                style={{ maxHeight: '500px' }}
              />
              {!isStreaming && (
                <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p>Camera preview will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {cameras.length > 0 && (
              <div className="w-full max-w-md">
                <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="text-sm text-gray-600 text-center max-w-md">
              <p>
                This page tests camera access using the WebRTC getUserMedia API. 
                Make sure to allow camera permissions when prompted.
              </p>
            </div>

            <div className="w-full mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Constraints & Capabilities</h2>
                <button
                  onClick={refreshTrackInfo}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium py-1.5 px-3 rounded-md transition-colors"
                >
                  Refresh info
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">Supported Constraints</h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(supportedConstraints, null, 2)}</pre>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">Track Capabilities</h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(trackCapabilities, null, 2)}</pre>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">Track Settings</h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(trackSettings, null, 2)}</pre>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">Applied Constraints</h3>
                  <div className="overflow-x-auto text-xs bg-gray-50 rounded-md p-3">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(trackConstraints, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-blue-500 hover:text-blue-600 underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
