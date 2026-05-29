import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ARScene } from '../components/ar/ARScene';
import { generateRoomQR } from '../utils/qrcode';
import { checkARSupport } from '../utils/xr';
import { randomColor } from '../utils/math';

interface User {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

export default function ARView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [arSupported, setArSupported] = useState<{
    supported: boolean;
    platformAR?: 'native' | 'web' | 'none';
    reason?: string;
    platform?: string;
  } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [users, setUsers] = useState<User[]>([
    { id: '1', name: 'You', color: randomColor(), isHost: true },
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const support = await checkARSupport();
        setArSupported(support);
      } catch {
        setArSupported({
          supported: false,
          platformAR: 'none',
        });
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (roomId) {
      generateRoomQR(roomId).then(setQrDataUrl);
    }
  }, [roomId]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-lg">Initializing AR...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const arModeIndicator =
    arSupported?.platformAR === 'native'
      ? { label: 'Native AR', color: 'text-green-400' }
      : arSupported?.platformAR === 'web'
        ? { label: '3D Preview', color: 'text-blue-400' }
        : { label: 'Limited Mode', color: 'text-yellow-400' };

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* AR Scene */}
      <ARScene roomId={roomId ?? ''} className="absolute inset-0" />

      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-sm text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Home
        </button>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm ${arModeIndicator.color}`}>
            {arModeIndicator.label}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80">{users.length} online</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/10 text-sm font-mono text-white/80">
            {roomId}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQR(!showQR)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white"
            title="Show QR Code"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
          <button
            onClick={() => setShowUsers(!showUsers)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white"
            title="User List"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white"
            title="Fullscreen"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* User List Panel */}
      {showUsers && (
        <div className="absolute right-4 top-20 z-20 w-64 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
          <h3 className="text-sm font-semibold text-white mb-3">Users in Room</h3>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user.name}</div>
                  {user.isHost && <span className="text-xs text-yellow-400">Host</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && qrDataUrl && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-gray-900/95 border border-white/20 rounded-3xl p-6 max-w-xs w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Share Room</h3>
            <p className="text-white/50 text-sm mb-4">Scan to join this room</p>
            <div className="bg-white rounded-xl p-3 mb-4 flex items-center justify-center">
              <img src={qrDataUrl} alt="Room QR Code" className="w-40 h-40" />
            </div>
            <div className="text-center mb-4">
              <span className="text-lg font-mono font-bold tracking-widest text-white bg-white/10 px-4 py-2 rounded-lg">
                {roomId}
              </span>
            </div>
            <button
              onClick={() => setShowQR(false)}
              className="w-full py-2 bg-white/10 border border-white/20 rounded-xl text-sm font-semibold text-white hover:bg-white/20 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
