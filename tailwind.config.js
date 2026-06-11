/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:        '#0f0f0f',
          'bg-card': '#1a1a1a',
          'bg-soft': '#222222',
          purple:    '#9333ea',
          'purple-light': '#a855f7',
          'purple-dark':  '#7e22ce',
          neon:      '#c8ff00',
          'neon-dark': '#a3d600',
          text:      '#ffffff',
          'text-muted': '#a3a3a3',
          'text-light': '#666666',
          border:    '#2a2a2a',
          'border-light': '#333333',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl':  '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'neon':       '0 0 20px rgba(200, 255, 0, 0.3)',
        'neon-lg':    '0 0 40px rgba(200, 255, 0, 0.4)',
        'purple':     '0 0 20px rgba(147, 51, 234, 0.4)',
        'purple-lg':  '0 0 40px rgba(147, 51, 234, 0.5)',
        'card':       '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(147, 51, 234, 0.3)',
      },
      backgroundImage: {
        'gradient-brand':  'linear-gradient(135deg, #0f0f0f 0%, #1a0a2e 100%)',
        'gradient-purple': 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
        'gradient-neon':   'linear-gradient(135deg, #c8ff00 0%, #a3d600 100%)',
        'gradient-card':   'linear-gradient(135deg, #1a1a1a 0%, #1e1030 100%)',
      },
    },
  },
  plugins: [],
}
