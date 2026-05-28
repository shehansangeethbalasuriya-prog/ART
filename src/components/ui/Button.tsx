import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg shadow-black/20',
  secondary:
    'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10',
  ghost:
    'bg-transparent hover:bg-white/10 text-gray-300 border border-transparent',
  danger:
    'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium
        backdrop-blur-md transition-all duration-200
        active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
        disabled:active:scale-100
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        iconLeft && <span className="flex-shrink-0">{iconLeft}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && (
        <span className="flex-shrink-0">{iconRight}</span>
      )}
    </button>
  );
};
