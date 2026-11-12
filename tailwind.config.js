/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        crimson: {
          50: '#fef2f3',
          100: '#fde6e7',
          500: '#dc143c',
          600: '#c41034',
          700: '#a30d2b',
        },
      },
    },
  },
  plugins: [],
};
