/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
