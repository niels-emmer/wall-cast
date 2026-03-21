import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#111111',
        panel: '#1a1a1a',
        border: '#2a2a2a',
        accent: '#00d4ff',
        muted: '#666666',
      },
    },
  },
  plugins: [],
} satisfies Config
