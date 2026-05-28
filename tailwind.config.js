/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.15)',
          300: 'rgba(255, 255, 255, 0.2)',
          400: 'rgba(255, 255, 255, 0.25)',
          500: 'rgba(255, 255, 255, 0.3)',
          600: 'rgba(255, 255, 255, 0.35)',
          700: 'rgba(255, 255, 255, 0.4)',
          800: 'rgba(255, 255, 255, 0.45)',
          900: 'rgba(255, 255, 255, 0.5)',
        },
        neon: {
          blue: '#00d4ff',
          purple: '#b347ea',
          pink: '#ff0080',
          green: '#00ff88',
          yellow: '#ffff00',
          cyan: '#00ffff',
        },
        surface: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a2e',
          elevated: '#252540',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.24)',
        'neon-blue': '0 0 20px rgba(0, 212, 255, 0.5)',
        'neon-purple': '0 0 20px rgba(179, 71, 234, 0.5)',
        'neon-pink': '0 0 20px rgba(255, 0, 128, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.8), 0 0 30px rgba(0, 212, 255, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};
