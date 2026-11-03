import type { Config } from 'tailwindcss';

/**
 * Paleta do LoneTale: pergaminho a luz de tocha.
 *
 * O tema escuro e o padrao, porque e onde a leitura longa cansa menos; o claro
 * existe para quem le de dia, com `data-theme="light"` no elemento raiz.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f3ec',
          100: '#e8e1d2',
          200: '#d2c6ae',
          300: '#b6a383',
          400: '#9a8360',
          500: '#7d684a',
          600: '#5f4f38',
          700: '#453a29',
          800: '#2b251b',
          900: '#1a1711',
          950: '#0f0d09',
        },
        ember: {
          300: '#f0b27a',
          400: '#e59145',
          500: '#d2721f',
          600: '#b05916',
          700: '#8a4312',
        },
        arcane: {
          300: '#9bb8f5',
          400: '#6f93e6',
          500: '#4a6fd0',
          600: '#3a55a8',
        },
        blood: {
          400: '#e06b5f',
          500: '#c0392b',
          600: '#97291e',
        },
        moss: {
          400: '#7fb98a',
          500: '#4f9361',
          600: '#3a6f49',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Spectral"', 'Georgia', 'serif'],
        ui: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(226,145,69,0.35), 0 0 24px rgba(226,145,69,0.15)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms ease-out both',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
