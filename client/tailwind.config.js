/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        salon: {
          bg: '#1F2937',
          dark: '#111827',
          surface: '#18212F',
          card: '#243042',
          elevated: '#2D3B4F',
          gold: '#D4A017',
          goldLight: '#E8BC42',
          goldDark: '#A87D10',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        goldPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 160, 23, 0.45)' },
          '50%': { boxShadow: '0 0 0 18px rgba(212, 160, 23, 0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'gold-pulse': 'goldPulse 2s infinite',
        'fade-in-up': 'fadeInUp 0.28s ease-out',
      },
    },
  },
  plugins: [],
};
