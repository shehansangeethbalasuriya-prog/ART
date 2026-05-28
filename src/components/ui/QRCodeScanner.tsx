import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ScanResult {
  roomCode: string;
  alignmentData?: string;
  timestamp: number;
}

interface QRCodeScannerProps {
  onScan: (result: ScanResult) => void;
  onClose: () => void;
  isActive?: boolean;
}

type CameraState = 'idle' | 'requesting' | 'active' | 'error';

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  onScan,
  onClose,
  isActive = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!isActive) return;

    setCameraState('requesting');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState('active');
        scanFrame();
      }
    } catch (err) {
      setCameraState('error');
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setErrorMessage('Camera access denied. Please grant permission.');
        } else if (err.name === 'NotFoundError') {
          setErrorMessage('No camera found on this device.');
        } else {
          setErrorMessage(`Camera error: ${err.message}`);
        }
      } else {
        setErrorMessage('Failed to access camera.');
      }
    }
  }, [isActive]);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let sumLuminance = 0;
      for (let i = 0; i < data.length; i += 4) {
        sumLuminance += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgLuminance = sumLuminance / (data.length / 4);

      if (avgLuminance < 10) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }
    } catch {
      // cross-origin or security error
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, []);

  useEffect(() => {
    if (isActive) {
      startCamera();
    }
    return () => stopCamera();
  }, [isActive, startCamera, stopCamera]);

  const handleManualInput = useCallback(() => {
    const code = prompt('Enter room code manually (6 characters):');
    if (code && code.trim().length === 6) {
      onScan({
        roomCode: code.trim().toUpperCase(),
        timestamp: Date.now(),
      });
    }
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-56 h-56">
            <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />

            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500 rounded-br-2xl" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-full h-0.5 bg-blue-500/70 animate-pulse
                  shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                style={{
                  animation: 'scanLine 2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>

        {cameraState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center space-y-4 px-8">
              <svg
                className="w-16 h-16 text-red-400 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                />
              </svg>
              <p className="text-white font-medium">{errorMessage}</p>
              <button
                onClick={handleManualInput}
                className="
                  px-4 py-2 bg-white/10 hover:bg-white/20 text-white
                  rounded-xl text-sm border border-white/20 transition-colors
                "
              >
                Enter Code Manually
              </button>
            </div>
          </div>
        )}

        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-white text-sm">Requesting camera access...</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <p className="text-xs text-gray-500 text-center">
          Point camera at QR code to scan
        </p>
        <button
          onClick={handleManualInput}
          className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Manual
        </button>
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-80px); }
          50% { transform: translateY(80px); }
        }
      `}</style>
    </div>
  );
};
