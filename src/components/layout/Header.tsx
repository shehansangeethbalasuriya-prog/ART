import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  onBack?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  isARSessionActive?: boolean;
}

export default function Header({
  onBack,
  onToggleSidebar,
  sidebarOpen = true,
  isARSessionActive = false,
}: HeaderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const currentRoom = useAppStore((s) => s.room.currentRoom);
  const darkMode = useAppStore((s) => s.ui.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, [signOut, navigate]);

  const userDisplayName = user?.displayName || (user?.isAnonymous ? `User ${user?.uid?.slice(0, 6)}` : 'Guest');
  const userAvatar = user?.photoURL;
  const userColor = user?.isAnonymous ? '#6B7280' : '#3B82F6';

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50 h-14
        flex items-center justify-between px-4
        border-b transition-colors duration-200
        ${darkMode
          ? 'bg-gray-800 border-gray-700 text-white'
          : 'bg-white border-gray-200 text-gray-900'
        }
        ${isARSessionActive ? 'bg-black/80 backdrop-blur-md border-transparent' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {isARSessionActive ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Exit AR</span>
          </button>
        ) : (
          <>
            <button
              onClick={onToggleSidebar}
              className={`
                p-2 rounded-lg transition-colors
                ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
              `}
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h1 className={`text-lg font-bold hidden sm:block ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                SharedSpace
              </h1>
            </div>
          </>
        )}
      </div>

      {currentRoom && !isARSessionActive && (
        <div className="hidden md:flex items-center gap-2">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Room:
          </span>
          <span className="text-sm font-semibold">{currentRoom.name}</span>
          <span className={`
            text-xs px-2 py-0.5 rounded-full
            ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}
          `}>
            {currentRoom.code}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className={`
            p-2 rounded-lg transition-colors
            ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}
          `}
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-offset-2"
            style={{
              backgroundColor: userColor,
            }}
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userDisplayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              userDisplayName.charAt(0).toUpperCase()
            )}
          </div>
          <span className={`text-sm font-medium hidden sm:block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {userDisplayName}
          </span>
        </div>

        <button
          onClick={handleSignOut}
          className={`
            p-2 rounded-lg transition-colors
            ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' : 'hover:bg-gray-100 text-gray-500 hover:text-red-500'}
          `}
          aria-label="Sign out"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
