/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: '#1d1836',
        mute: '#6f6a8a',
        line: '#ece8f6',
        paper: '#fcfbff',
        brand: {
          50: '#f5eefe',
          100: '#eadcfd',
          200: '#d7bcfa',
          300: '#bd93f5',
          400: '#a46aee',
          500: '#8a45e0',
          600: '#7430c8',
          700: '#5f26a6',
        },
        gold: {
          200: '#f4e3b1',
          300: '#ecd28b',
          400: '#e0b95a',
          500: '#c99a3a',
        },
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(95, 38, 166, 0.25)',
        card: '0 14px 28px -10px rgba(29, 24, 54, 0.35)',
      },
    },
  },
  plugins: [],
}
