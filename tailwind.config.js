/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0d0d',
          50: '#1a1a1a',
          100: '#222222',
          200: '#2a2a2a',
          300: '#333333',
          400: '#404040',
          500: '#525252'
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#8b5cf6',
          dark: '#6d28d9'
        },
        muted: '#6b7280',
        border: '#2a2a2a'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
