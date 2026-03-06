/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        oswald: ['Oswald', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        'gn-red': '#E60000',
        'gn-panel': '#1a1a1a',
        'gn-bg': '#121212',
      },
      animation: {
        'scan-line': 'scan 2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%': { top: '0%', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        }
      },
      boxShadow: {
        'neon-red': '0 0 15px rgba(230, 0, 0, 0.4)',
        'neon-inset': 'inset 0 0 15px rgba(230, 0, 0, 0.2)',
      }
    },
  },
  plugins: [],
}