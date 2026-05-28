import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkARSupport } from '../utils/xr';
import { generateRoomQR } from '../utils/qrcode';
import { generateRandomRoomCode } from '../utils/math';

interface ARSupport {
  supported: boolean;
  reason?: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [arSupport, setArSupport] = useState<ARSupport | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [createdRoomQR, setCreatedRoomQR] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);

  useEffect(() => {
    checkARSupport().then(setArSupport);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    setIsCreating(true);
    try {
      const roomCode = generateRandomRoomCode();
      const qrDataUrl = await generateRoomQR(roomCode);
      setCreatedRoomCode(roomCode);
      setCreatedRoomQR(qrDataUrl);
      setShowQR(true);
    } catch (err) {
      console.error('Failed to create room:', err);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const handleJoinRoom = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 6) {
      navigate(`/ar/${code}`);
    }
  }, [joinCode, navigate]);

  const handleJoinCreatedRoom = useCallback(() => {
    if (createdRoomCode) {
      navigate(`/ar/${createdRoomCode}`);
    }
  }, [createdRoomCode, navigate]);

  const features = [
    {
      title: 'Real-time Sync',
      description: 'See other users\' objects instantly as they place them in shared AR space.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: 'Persistent World',
      description: 'Objects stay anchored in the real world between sessions.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Spatial Alignment',
      description: 'Multi-user coordinate systems ensure objects align perfectly across devices.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-xl bg-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            SharedSpace AR
          </span>
        </div>
        <div className="flex items-center gap-4">
          {arSupport && (
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              arSupport.supported 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {arSupport.supported ? 'AR Ready' : 'AR Unavailable'}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="px-6 py-20 md:py-32 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white/80 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Multiplayer AR is here
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              SharedSpace
            </span>
            <br />
            <span className="text-white/90">AR</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
            Place, share, and interact with 3D objects in augmented reality with anyone nearby. 
            No apps to install — just open your browser and step into a shared world.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-semibold text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Room
                </span>
              )}
            </button>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                maxLength={6}
                className="px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent backdrop-blur-sm w-44 text-center text-lg font-mono tracking-widest uppercase"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <button
                onClick={handleJoinRoom}
                disabled={joinCode.trim().length !== 6}
                className="px-6 py-4 bg-white/10 border border-white/20 rounded-2xl font-semibold text-lg hover:bg-white/20 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                Join
              </button>
            </div>
          </div>

          {/* QR Code Modal */}
          {showQR && createdRoomQR && createdRoomCode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
              <div className="bg-gray-900/95 border border-white/20 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-2">Room Created</h3>
                <p className="text-white/60 text-sm mb-6">Scan this QR code or share the code with others</p>
                
                <div className="bg-white rounded-2xl p-4 mb-4 flex items-center justify-center">
                  <img src={createdRoomQR} alt="Room QR Code" className="w-48 h-48" />
                </div>
                
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-white/60 text-sm">Room Code:</span>
                  <span className="text-2xl font-mono font-bold tracking-widest text-white bg-white/10 px-4 py-1 rounded-lg">
                    {createdRoomCode}
                  </span>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleJoinCreatedRoom}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                  >
                    Enter Room
                  </button>
                  <button
                    onClick={() => setShowQR(false)}
                    className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Features */}
        <section className="px-6 pb-20 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Device Compatibility */}
        <section className="px-6 pb-20 max-w-4xl mx-auto">
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Device Compatibility</h3>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl mb-2">📱</div>
                <div className="font-semibold text-white">Android</div>
                <div className="text-sm text-white/50">Chrome 81+ with ARCore</div>
              </div>
              <div>
                <div className="text-3xl mb-2">🍎</div>
                <div className="font-semibold text-white">iOS</div>
                <div className="text-sm text-white/50">Safari on iOS 15+</div>
              </div>
              <div>
                <div className="text-3xl mb-2">🖥️</div>
                <div className="font-semibold text-white">Desktop</div>
                <div className="text-sm text-white/50">Preview mode (no AR)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-white/10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-purple-600" />
              SharedSpace AR &copy; {new Date().getFullYear()}
            </div>
            <div className="flex items-center gap-4 text-sm text-white/40">
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10">React 18</span>
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10">Three.js</span>
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10">WebXR</span>
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10">WebSocket</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
