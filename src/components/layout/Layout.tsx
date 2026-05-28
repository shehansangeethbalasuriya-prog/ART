import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isARSessionActive, setIsARSessionActive] = useState(false);

  const darkMode = useAppStore((s) => s.ui.darkMode);
  const currentRoom = useAppStore((s) => s.room.currentRoom);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleBackFromAR = useCallback(() => {
    setIsARSessionActive(false);
    navigate('/');
  }, [navigate]);

  if (isARSessionActive) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <Header
          onBack={handleBackFromAR}
          isARSessionActive={isARSessionActive}
        />
        <div className="relative w-full h-full pt-14">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
        isARSessionActive={isARSessionActive}
      />

      <div className="flex flex-1 pt-14">
        <aside
          className={`
            fixed left-0 top-14 bottom-0 z-40
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'w-64' : 'w-0 md:w-16'}
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
            border-r overflow-hidden
            ${isMobile && sidebarOpen ? 'shadow-2xl' : ''}
          `}
        >
          <nav className="p-4 space-y-2">
            <button
              onClick={() => navigate('/')}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors duration-150
                ${darkMode
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {sidebarOpen && <span>Home</span>}
            </button>

            {currentRoom && (
              <button
                onClick={() => navigate('/room')}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${darkMode
                    ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {sidebarOpen && (
                  <div className="flex flex-col items-start">
                    <span>Room</span>
                    <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {currentRoom.name}
                    </span>
                  </div>
                )}
              </button>
            )}

            <button
              onClick={() => navigate('/settings')}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors duration-150
                ${darkMode
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {sidebarOpen && <span>Settings</span>}
            </button>
          </nav>
        </aside>

        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main
          className={`
            flex-1 transition-all duration-300
            ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'}
            ${isMobile ? 'ml-0' : ''}
          `}
        >
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
