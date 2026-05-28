import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateRoomQR } from '../utils/qrcode';
import { checkARSupport } from '../utils/xr';
import { randomColor } from '../utils/math';

interface User {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

interface PlacedObject {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  placedBy: string;
}

type Tool = 'select' | 'cube' | 'sphere' | 'cylinder' | 'text' | 'delete';

export default function ARView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedObject, setSelectedObject] = useState<PlacedObject | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [users, setUsers] = useState<User[]>([
    { id: '1', name: 'You', color: randomColor(), isHost: true },
  ]);
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const support = await checkARSupport();
        setArSupported(support.supported);
      } catch {
        setArSupported(false);
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

  const handlePlaceObject = useCallback((type: Tool) => {
    if (type === 'select' || type === 'delete') return;

    const newObj: PlacedObject = {
      id: crypto.randomUUID(),
      type,
      position: [
        (Math.random() - 0.5) * 2,
        0.5,
        (Math.random() - 0.5) * 2,
      ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: randomColor(),
      placedBy: '1',
    };

    setPlacedObjects((prev) => [...prev, newObj]);
  }, []);

  const handleSelectObject = useCallback((obj: PlacedObject) => {
    setSelectedObject(obj);
    setShowProperties(true);
  }, []);

  const handleDeleteObject = useCallback((id: string) => {
    setPlacedObjects((prev) => prev.filter((o) => o.id !== id));
    setSelectedObject(null);
    setShowProperties(false);
  }, []);

  const handleSceneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool === 'select') {
        setSelectedObject(null);
        setShowProperties(false);
        return;
      }
      if (activeTool === 'delete') return;
      handlePlaceObject(activeTool);
    },
    [activeTool, handlePlaceObject]
  );

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await sceneRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const tools: { id: Tool; label: string; icon: JSX.Element }[] = [
    {
      id: 'select',
      label: 'Select',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      ),
    },
    {
      id: 'cube',
      label: 'Cube',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'sphere',
      label: 'Sphere',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
        </svg>
      ),
    },
    {
      id: 'cylinder',
      label: 'Cylinder',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <ellipse cx="12" cy="6" rx="8" ry="3" strokeWidth={2} />
          <path d="M4 6v12c0 1.657 3.582 3 8 3s8-1.343 8-3V6" strokeWidth={2} />
        </svg>
      ),
    },
    {
      id: 'text',
      label: 'Text',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M8 6v12m8-12v12M6 18h4m4 0h4" />
        </svg>
      ),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
    },
  ];

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

  return (
    <div ref={sceneRef} className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* AR Scene */}
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        }
      >
        <div
          className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-950 cursor-crosshair"
          onClick={handleSceneClick}
        >
          {/* Simulated AR Grid */}
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              perspective: '500px',
              transform: 'rotateX(60deg)',
              transformOrigin: 'center 80%',
            }} />
          </div>

          {/* Placed Objects (rendered in scene) */}
          {placedObjects.map((obj) => (
            <div
              key={obj.id}
              className={`absolute cursor-pointer transition-all duration-200 hover:scale-110 ${
                selectedObject?.id === obj.id ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
              }`}
              style={{
                left: `${50 + obj.position[0] * 20}%`,
                top: `${50 + obj.position[2] * 20}%`,
                transform: `translate(-50%, -50%)`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectObject(obj);
              }}
            >
              <div
                className="w-12 h-12 rounded-lg shadow-lg flex items-center justify-center"
                style={{ backgroundColor: obj.color }}
              >
                {obj.type === 'cube' && <div className="w-6 h-6 bg-white/30 rounded" />}
                {obj.type === 'sphere' && <div className="w-6 h-6 bg-white/30 rounded-full" />}
                {obj.type === 'cylinder' && <div className="w-4 h-6 bg-white/30 rounded-full" />}
                {obj.type === 'text' && <span className="text-white text-xs font-bold">T</span>}
              </div>
            </div>
          ))}

          {/* AR Not Available Message */}
          {arSupported === false && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <div className="text-4xl mb-4">📷</div>
                <p className="text-white/80 mb-2">AR Mode Unavailable</p>
                <p className="text-white/40 text-sm">Running in preview mode. Objects are placed in a simulated view.</p>
              </div>
            </div>
          )}
        </div>
      </Suspense>

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              if (tool.id !== 'select' && tool.id !== 'delete') {
                handlePlaceObject(tool.id);
              }
            }}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
              activeTool === tool.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white backdrop-blur-sm'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
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
                  {user.isHost && (
                    <span className="text-xs text-yellow-400">Host</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Object Properties Panel */}
      {showProperties && selectedObject && (
        <div className="absolute right-4 bottom-24 z-20 w-72 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white capitalize">{selectedObject.type} Properties</h3>
            <button
              onClick={() => {
                setSelectedObject(null);
                setShowProperties(false);
              }}
              className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Color</label>
              <div className="flex gap-2">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-white/20"
                  style={{ backgroundColor: selectedObject.color }}
                />
                <span className="text-sm text-white/80 flex items-center">{selectedObject.color}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 block mb-1">Position</label>
              <div className="grid grid-cols-3 gap-2">
                {['X', 'Y', 'Z'].map((axis, i) => (
                  <div key={axis} className="text-center">
                    <div className="text-xs text-white/40 mb-1">{axis}</div>
                    <div className="px-2 py-1 bg-white/5 rounded text-sm text-white/80 font-mono">
                      {selectedObject.position[i].toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 block mb-1">Placed by</label>
              <div className="text-sm text-white/80">
                {users.find((u) => u.id === selectedObject.placedBy)?.name ?? 'Unknown'}
              </div>
            </div>

            <button
              onClick={() => handleDeleteObject(selectedObject.id)}
              className="w-full py-2 mt-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-all"
            >
              Delete Object
            </button>
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

      {/* Bottom Toolbar Info */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="px-4 py-2 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-sm text-white/60">
          {activeTool === 'select' && 'Tap an object to select it'}
          {activeTool === 'delete' && 'Tap an object to delete it'}
          {activeTool !== 'select' && activeTool !== 'delete' && 'Tap in the scene to place object'}
        </div>
      </div>
    </div>
  );
}
