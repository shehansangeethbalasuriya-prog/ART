import React, { useCallback } from 'react';

interface ObjectTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

interface SelectedObject {
  id: string;
  type: string;
  name: string;
  color: string;
  locked: boolean;
  transform: ObjectTransform;
}

interface ObjectPanelProps {
  object: SelectedObject | null;
  onUpdate: (id: string, updates: Partial<SelectedObject>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const VectorInput: React.FC<{
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (value: { x: number; y: number; z: number }) => void;
  step?: number;
  disabled?: boolean;
}> = ({ label, value, onChange, step = 0.1, disabled }) => {
  const handleChange = useCallback(
    (axis: 'x' | 'y' | 'z', numStr: string) => {
      const num = parseFloat(numStr);
      if (!isNaN(num)) {
        onChange({ ...value, [axis]: num });
      }
    },
    [value, onChange]
  );

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <div key={axis} className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500">
              {axis.toUpperCase()}
            </span>
            <input
              type="number"
              value={Number(value[axis].toFixed(2))}
              onChange={(e) => handleChange(axis, e.target.value)}
              step={step}
              disabled={disabled}
              className="
                w-full pl-7 pr-1 py-1.5 rounded-lg text-xs text-white
                bg-white/5 border border-white/10
                focus:outline-none focus:border-blue-500/50
                disabled:opacity-50 disabled:cursor-not-allowed
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none
              "
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ObjectPanel: React.FC<ObjectPanelProps> = ({
  object,
  onUpdate,
  onDelete,
  onClose,
}) => {
  if (!object) return null;

  const handleTransformUpdate = (
    key: 'position' | 'rotation' | 'scale',
    value: { x: number; y: number; z: number }
  ) => {
    onUpdate(object.id, {
      transform: { ...object.transform, [key]: value },
    });
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-72">
      <div
        className="
          bg-white/10 backdrop-blur-xl
          border border-white/20 rounded-2xl
          shadow-2xl shadow-black/40
          overflow-hidden
        "
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: object.color }}
            />
            <span className="text-sm font-medium text-white">{object.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white
              hover:bg-white/10 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <VectorInput
            label="Position"
            value={object.transform.position}
            onChange={(v) => handleTransformUpdate('position', v)}
            disabled={object.locked}
          />

          <VectorInput
            label="Rotation"
            value={object.transform.rotation}
            onChange={(v) => handleTransformUpdate('rotation', v)}
            step={1}
            disabled={object.locked}
          />

          <VectorInput
            label="Scale"
            value={object.transform.scale}
            onChange={(v) => handleTransformUpdate('scale', v)}
            disabled={object.locked}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={object.color}
                onChange={(e) =>
                  onUpdate(object.id, { color: e.target.value })
                }
                disabled={object.locked}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={object.color}
                onChange={(e) =>
                  onUpdate(object.id, { color: e.target.value })
                }
                disabled={object.locked}
                className="
                  flex-1 px-3 py-1.5 rounded-lg text-xs text-white font-mono
                  bg-white/5 border border-white/10
                  focus:outline-none focus:border-blue-500/50
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              onClick={() =>
                onUpdate(object.id, { locked: !object.locked })
              }
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-colors
                ${
                  object.locked
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }
              `}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {object.locked ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  />
                )}
              </svg>
              {object.locked ? 'Locked' : 'Unlocked'}
            </button>

            <button
              onClick={() => onDelete(object.id)}
              className="
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-red-500/20 text-red-400 border border-red-500/30
                hover:bg-red-500/30 transition-colors
              "
            >
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
