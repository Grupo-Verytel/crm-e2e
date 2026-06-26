/** Tailwind theme bound to Verytel tokens. Use these classes; never raw hex. */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: 'var(--brand-primary)', primary: 'var(--brand-primary)', 700: 'var(--brand-primary-700)' },
        turquoise: 'var(--brand-turquoise)',
        ink: 'var(--ink)',
        navy: 'var(--navy)', 'blue-500': 'var(--blue-500)', sky: 'var(--sky)',
        bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)', muted: 'var(--text-muted)',
        positive: 'var(--positive)', warning: 'var(--warning)', danger: 'var(--danger)',
      },
      fontFamily: { ui: ['Century Gothic', 'Questrial', 'system-ui', 'sans-serif'] },
      borderRadius: { DEFAULT: 'var(--radius)', sm: 'var(--radius-sm)' },
      boxShadow: { card: 'var(--shadow-card)' },
    },
  },
  plugins: [],
};
