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
        whatsapp: {
          light: '#25D366',
          DEFAULT: '#00A884',
          dark: '#008069',
          teal: '#128C7E',
          bg: '#111B21',
          panel: '#202C33',
          bubble: '#005C4B',
          bubbleIn: '#202C33',
          border: '#2A3942',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        }
      },
    },
  },
  plugins: [],
}
