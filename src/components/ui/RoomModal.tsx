import React, { useState, useCallback } from 'react';

interface RecentRoom {
  id: string;
  name: string;
  code: string;
  lastJoined: number;
}

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (name: string) => Promise<string>;
  onJoinRoom: (code: string) => Promise<void>;
  recentRooms?: RecentRoom[];
  error?: string | null;
}

type Tab = 'create' | 'join';

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  onJoinRoom,
  recentRooms = [],
  error: externalError,
}) => {
  const [tab, setTab] = useState<Tab>('create');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const displayError = externalError ?? error;

  const handleCreate = useCallback(async () => {
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = await onCreateRoom(roomName.trim());
      setCreatedCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }, [roomName, onCreateRoom]);

  const handleJoin = useCallback(async () => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (normalizedCode.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onJoinRoom(normalizedCode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }, [roomCode, onJoinRoom, onClose]);

  const handleJoinRecent = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        await onJoinRoom(code);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room');
      } finally {
        setLoading(false);
      }
    },
    [onJoinRoom, onClose]
  );

  const copyCode = useCallback(() => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
    }
  }, [createdCode]);

  const handleCodeInput = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCode(cleaned);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="
          w-full max-w-md
          bg-white/10 backdrop-blur-xl
          border border-white/20 rounded-2xl
          shadow-2xl shadow-black/40
          animate-in zoom-in-95 fade-in duration-200
        "
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Multiplayer Room</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white
              hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {(['create', 'join'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
                setCreatedCode(null);
              }}
              className={`
                flex-1 py-3 text-sm font-medium transition-colors capitalize
                ${
                  tab === t
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300'
                }
              `}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 space-y-4">
          {createdCode ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-400 text-sm mb-2">Room created!</p>
                <p className="text-3xl font-mono font-bold text-white tracking-widest">
                  {createdCode}
                </p>
              </div>
              <button
                onClick={copyCode}
                className="
                  w-full py-2.5 rounded-xl text-sm font-medium
                  bg-white/10 hover:bg-white/20 text-white
                  border border-white/20 transition-colors
                "
              >
                Copy Code
              </button>
            </div>
          ) : tab === 'create' ? (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="My AR Room"
                  className="
                    w-full px-4 py-2.5 rounded-xl text-sm text-white
                    bg-white/5 border border-white/10
                    placeholder:text-gray-500 focus:outline-none
                    focus:border-blue-500/50 focus:bg-white/10 transition-colors
                  "
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={loading || !roomName.trim()}
                className="
                  w-full py-2.5 rounded-xl text-sm font-medium
                  bg-blue-500/20 hover:bg-blue-500/30 text-blue-400
                  border border-blue-500/30 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => handleCodeInput(e.target.value)}
                  placeholder="ABC123"
                  maxLength={6}
                  className="
                    w-full px-4 py-2.5 rounded-xl text-sm text-white
                    font-mono text-center text-xl tracking-[0.3em]
                    bg-white/5 border border-white/10
                    placeholder:text-gray-500 focus:outline-none
                    focus:border-blue-500/50 focus:bg-white/10 transition-colors
                  "
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={loading || roomCode.length !== 6}
                className="
                  w-full py-2.5 rounded-xl text-sm font-medium
                  bg-blue-500/20 hover:bg-blue-500/30 text-blue-400
                  border border-blue-500/30 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </>
          )}

          {displayError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{displayError}</p>
            </div>
          )}

          {recentRooms.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Recent Rooms
              </h3>
              <div className="space-y-1">
                {recentRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => handleJoinRecent(room.code)}
                    disabled={loading}
                    className="
                      w-full flex items-center justify-between px-3 py-2 rounded-lg
                      hover:bg-white/5 transition-colors text-left
                    "
                  >
                    <div>
                      <p className="text-sm text-white">{room.name}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {room.code}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
