import { useEffect, useRef, useState } from 'react'

export function VideoTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const startCamera = async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      
      setStream(mediaStream)
      setIsStreaming(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'
      setError(errorMessage)
      console.error('Error accessing camera:', err)
    }
  }

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
                    <div className="text-6xl mb-4">📹</div>
                    <p>Camera preview will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg w-full">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="flex flex-wrap gap-4 justify-center">
              {!isStreaming ? (
                <button
                  onClick={startCamera}
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
