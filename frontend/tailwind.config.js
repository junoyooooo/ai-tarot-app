/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Gowun Batang"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        gold: {
          200: '#f4e3b1',
          300: '#ecd28b',
          400: '#e0b95a',
          500: '#c99a3a',
        },
        night: {
          950: '#07070f',
          900: '#0d0c1d',
          800: '#15132b',
          700: '#1e1b3a',
        },
        tarot: {
          dark: '#0a0915',
          card: '#161329',
          purple: '#6d28d9',
          gold: '#f59e0b',
          mystic: '#8b5cf6'
        }
      }
    },
  },
  plugins: [],
}
