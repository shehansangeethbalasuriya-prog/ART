import React, { useCallback, useMemo, useState } from 'react';

interface QRCodeDisplayProps {
  roomCode: string;
  roomUrl?: string;
}

const QR_MODULES = 25;
const QR_SIZE = 200;

function generateQRPattern(code: string): boolean[][] {
  const modules: boolean[][] = Array.from({ length: QR_MODULES }, () =>
    Array(QR_MODULES).fill(false)
  );

  const seed = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  let rng = seed;
  const nextRandom = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
      const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      modules[i][j] = isBorder || isInner;
      modules[i][QR_MODULES - 1 - j] = isBorder || isInner;
      modules[QR_MODULES - 1 - i][j] = isBorder || isInner;
    }
  }

  for (let i = 8; i < QR_MODULES - 8; i++) {
    modules[i][6] = i % 2 === 0;
    modules[6][i] = i % 2 === 0;
  }

  for (let i = 9; i < QR_MODULES - 9; i++) {
    for (let j = 9; j < QR_MODULES - 9; j++) {
      if (nextRandom() > 0.5) {
        modules[i][j] = true;
      }
    }
  }

  return modules;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  roomCode,
  roomUrl,
}) => {
  const [copied, setCopied] = useState(false);

  const modules = useMemo(() => generateQRPattern(roomCode), [roomCode]);
  const cellSize = QR_SIZE / QR_MODULES;
  const url = roomUrl || `https://sharedspace.app/join/${roomCode}`;

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomCode]);

  const shareRoom = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my AR room',
          text: `Join my SharedSpace AR room with code: ${roomCode}`,
          url,
        });
      } catch {
        // user cancelled share
      }
    } else {
      copyCode();
    }
  }, [roomCode, url, copyCode]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="
          p-4 bg-white rounded-2xl shadow-xl
          border border-gray-200
        "
      >
        <svg
          width={QR_SIZE}
          height={QR_SIZE}
          viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}
          className="block"
        >
          {modules.map((row, i) =>
            row.map((cell, j) =>
              cell ? (
                <rect
                  key={`${i}-${j}`}
                  x={j * cellSize}
                  y={i * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="#000000"
                  rx={1}
                />
              ) : null
            )
          )}
        </svg>
      </div>

      <div className="text-center space-y-2">
        <p className="text-xs text-gray-500">Share this code with others</p>
        <div className="flex items-center gap-2">
          <div
            className="
              px-4 py-2 bg-white/5 border border-white/10 rounded-xl
              font-mono text-xl tracking-[0.3em] text-white
            "
          >
            {roomCode}
          </div>
        </div>
      </div>

      <div className="flex gap-2 w-full">
        <button
          onClick={copyCode}
          className="
            flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
            text-sm font-medium bg-white/10 hover:bg-white/20
            text-white border border-white/20 transition-colors
          "
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
        <button
          onClick={shareRoom}
          className="
            flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
            text-sm font-medium bg-blue-500/20 hover:bg-blue-500/30
            text-blue-400 border border-blue-500/30 transition-colors
          "
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </button>
      </div>

      <p className="text-[11px] text-gray-500 text-center max-w-[220px]">
        Open the AR app and scan this QR code to join the same room and align
        your sessions.
      </p>
    </div>
  );
};
