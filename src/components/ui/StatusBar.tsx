import React from 'react';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  userCount: number;
  objectCount: number;
  fps: number;
  alignmentStatus?: string;
}

const statusColors: Record<ConnectionStatus, { dot: string; label: string }> = {
  connected: { dot: 'bg-green-400', label: 'Connected' },
  connecting: { dot: 'bg-yellow-400 animate-pulse', label: 'Connecting' },
  disconnected: { dot: 'bg-red-400', label: 'Disconnected' },
};

export const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus,
  userCount,
  objectCount,
  fps,
  alignmentStatus,
}) => {
  const status = statusColors[connectionStatus];

  return (
    <div className="fixed top-4 left-4 z-40">
      <div
        className="
          bg-white/10 backdrop-blur-xl
          border border-white/20 rounded-xl
          shadow-xl shadow-black/30
          px-4 py-2.5
          flex items-center gap-4 text-xs
        "
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className="text-gray-300">{status.label}</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        <div className="flex items-center gap-1.5 text-gray-400">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="font-medium text-white">{userCount}</span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-400">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span className="font-medium text-white">{objectCount}</span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-400">
          <span className={`font-medium ${fps < 30 ? 'text-red-400' : fps < 55 ? 'text-yellow-400' : 'text-white'}`}>
            {fps}
          </span>
          <span>FPS</span>
        </div>

        {alignmentStatus && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-1.5 text-gray-400">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>{alignmentStatus}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
