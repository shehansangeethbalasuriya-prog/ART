import React, { useState } from 'react';

interface User {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
  avatar?: string;
}

interface UserListProps {
  users: User[];
  collapsed?: boolean;
  onToggle?: () => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  collapsed: controlledCollapsed,
  onToggle,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const toggle = onToggle ?? (() => setInternalCollapsed(!internalCollapsed));

  const onlineCount = users.filter((u) => u.isOnline).length;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div
      className="
        fixed top-4 right-4 z-40
        bg-white/10 backdrop-blur-xl
        border border-white/20 rounded-2xl
        shadow-2xl shadow-black/40
        overflow-hidden transition-all duration-300
        min-w-[180px]
      "
    >
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3
          hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Users</span>
          <span
            className="
              px-2 py-0.5 text-[10px] font-bold rounded-full
              bg-green-500/20 text-green-400 border border-green-500/30
            "
          >
            {onlineCount}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            collapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
        }`}
      >
        <div className="px-2 pb-2 space-y-1">
          {users.map((user) => (
            <div
              key={user.id}
              className="
                flex items-center gap-3 px-2 py-1.5 rounded-lg
                hover:bg-white/5 transition-colors group relative
              "
            >
              <div className="relative flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center
                      text-xs font-bold text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {getInitials(user.name)}
                  </div>
                )}
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2
                    border-gray-900 ${
                      user.isOnline ? 'bg-green-400' : 'bg-gray-500'
                    }`}
                />
              </div>

              <span className="text-sm text-gray-300 truncate">{user.name}</span>

              <div
                className="
                  absolute left-1/2 -translate-x-1/2 -top-8
                  bg-gray-900 text-white text-xs px-2 py-1 rounded
                  opacity-0 group-hover:opacity-100 transition-opacity
                  pointer-events-none whitespace-nowrap
                "
              >
                {user.name}
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No users connected
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
