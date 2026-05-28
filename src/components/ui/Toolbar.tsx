import React, { useRef } from 'react';

type ObjectType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'custom';

interface ToolbarProps {
  selectedType: ObjectType | null;
  onSelectType: (type: ObjectType) => void;
}

interface ObjectTypeItem {
  type: ObjectType;
  label: string;
  icon: React.ReactNode;
}

const objectTypes: ObjectTypeItem[] = [
  {
    type: 'cube',
    label: 'Cube',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M20 7L12 3L4 7V17L12 21L20 17V7Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 12L4 7M12 12L20 7M12 12V21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    type: 'sphere',
    label: 'Sphere',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="4"
          stroke="currentColor"
          strokeWidth="1.5"
          transform="rotate(45 12 12)"
        />
      </svg>
    ),
  },
  {
    type: 'cylinder',
    label: 'Cylinder',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 6V18C5 19.657 8.134 21 12 21C15.866 21 19 19.657 19 18V6"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    type: 'cone',
    label: 'Cone',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <ellipse cx="12" cy="18" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 3L5 18M12 3L19 18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    type: 'torus',
    label: 'Torus',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="6"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="4"
          ry="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    type: 'custom',
    label: 'Custom',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M12 3L3 8V16L12 21L21 16V8L12 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 12L3 8M12 12L21 8M12 12V21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.5"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
  },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedType,
  onSelectType,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div
        className="
          bg-white/10 backdrop-blur-xl
          border border-white/20 rounded-2xl
          shadow-2xl shadow-black/40
          px-3 py-2
        "
      >
        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto
            scrollbar-none max-w-[90vw] md:max-w-none"
        >
          {objectTypes.map((item) => (
            <button
              key={item.type}
              onClick={() => onSelectType(item.type)}
              title={item.label}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                transition-all duration-200 min-w-[60px]
                ${
                  selectedType === item.type
                    ? 'bg-white/20 text-white shadow-lg shadow-blue-500/20 border border-white/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                }
              `}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
