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
        'bg-app': '#FAFAFA',
        'surface': '#FFFFFF',
        'border-subtle': '#E7E5F0',
        'accent-primary': '#7C3AED',
        'accent-warm': '#FF6B4A',
        'state-available': '#22C55E',
        'state-held': '#D1D5DB',
        'text-primary': '#111827',
        'text-muted': '#6B7280',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        seatClick: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'seat-click': 'seatClick 150ms ease-in-out',
        'fade-slide-up': 'fadeSlideUp 250ms ease-out forwards',
      },
    },
  },
  plugins: [],
}