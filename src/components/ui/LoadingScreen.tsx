import React from 'react';

interface LoadingScreenProps {
  progress?: number;
  statusMessage?: string;
  showBranding?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  statusMessage = 'Initializing...',
  showBranding = true,
}) => {
  return (
    <div
      className="
        fixed inset-0 z-[100]
        flex flex-col items-center justify-center
        bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950
      "
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-8">
        {showBranding && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div
                className="
                  w-20 h-20 rounded-2xl
                  bg-white/10 backdrop-blur-xl
                  border border-white/20
                  flex items-center justify-center
                  shadow-2xl shadow-blue-500/20
                "
              >
                <svg
                  className="w-10 h-10 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 22V12M12 12L2 7M12 12L22 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    opacity="0.5"
                  />
                  <circle cx="12" cy="8" r="2" fill="currentColor" />
                </svg>
              </div>
              <div className="absolute -inset-1 bg-blue-500/20 rounded-2xl blur-lg animate-pulse" />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                SharedSpace
              </h1>
              <p className="text-sm text-gray-400 mt-1">AR Collaboration</p>
            </div>
          </div>
        )}

        <div className="w-64 space-y-3">
          <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
            <div
              className="
                absolute inset-y-0 left-0
                bg-gradient-to-r from-blue-500 to-purple-500
                rounded-full transition-all duration-500 ease-out
              "
              style={{
                width: progress !== undefined ? `${Math.max(progress, 5)}%` : '100%',
                animation: progress === undefined ? 'indeterminate 1.5s ease-in-out infinite' : undefined,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{statusMessage}</p>
            {progress !== undefined && (
              <p className="text-xs text-gray-400 font-medium">
                {Math.round(progress)}%
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-center">
        <p className="text-[10px] text-gray-600">
          Powered by WebXR &bull; SharedSpace v1.0
        </p>
      </div>

      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 40%; }
          50% { transform: translateX(100%); width: 60%; }
          100% { transform: translateX(-100%); width: 40%; }
        }
      `}</style>
    </div>
  );
};
