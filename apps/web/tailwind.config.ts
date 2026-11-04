import type { Config } from 'tailwindcss';

/**
 * Paleta do LoneTale: pergaminho sob moldura de bronze, a luz de tocha.
 *
 * A interface e um livro aberto sobre uma mesa escura. O conteudo narrativo
 * vive em pergaminho claro -- e onde se le por muito tempo -- e tudo ao redor
 * (molduras, trilhos, barras) e madeira escura com metal, para que a pagina
 * seja sempre o ponto mais claro da tela.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Superficie escura: a mesa e as molduras.
        night: {
          600: '#3a2a1c',
          700: '#2a1e15',
          800: '#1c1410',
          900: '#120d08',
          950: '#0a0705',
        },
        // Metal das bordas e ornamentos.
        bronze: {
          200: '#efd9a0',
          300: '#d9b35c',
          400: '#b8923f',
          500: '#8a6a35',
          600: '#5c4420',
          700: '#3d2d15',
        },
        // A pagina.
        parchment: {
          50: '#fbf3e0',
          100: '#f4e4c1',
          200: '#e6d2a8',
          300: '#d8c08c',
          400: '#c4a871',
          500: '#ab8d57',
        },
        // Tinta sobre o pergaminho.
        sepia: {
          400: '#8a6c43',
          500: '#6b4f2a',
          600: '#57401f',
          700: '#4a3519',
          800: '#3c2a17',
          900: '#2a1c0e',
        },
        // Acentos de jogo.
        ember: {
          300: '#f0b27a',
          400: '#e59145',
          500: '#d2721f',
          600: '#b05916',
          700: '#8a4312',
        },
        arcane: { 300: '#9bb8f5', 400: '#6f93e6', 500: '#4a6fd0', 600: '#3a55a8' },
        blood: { 400: '#e06b5f', 500: '#c0392b', 600: '#97291e', 700: '#7b241c' },
        moss: { 400: '#7fb98a', 500: '#4f9361', 600: '#3a6f49' },
        gold: { 300: '#f5d07a', 400: '#e3aa43', 500: '#c98f2a' },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Spectral"', 'Georgia', 'serif'],
        ui: ['"Spectral"', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0,0,0,0.45)',
        parchment:
          'inset 0 0 60px rgba(139,105,53,0.22), inset 0 0 6px rgba(90,65,25,0.35), 0 8px 24px rgba(0,0,0,0.4)',
        inset: 'inset 0 2px 6px rgba(0,0,0,0.45)',
        gold: '0 0 0 1px rgba(227,170,67,0.55), 0 0 18px rgba(227,170,67,0.25)',
      },
      backgroundImage: {
        'parchment-sheet':
          'linear-gradient(160deg, #fbf3e0 0%, #f4e4c1 38%, #e8d6ae 72%, #ddc89c 100%)',
        'bronze-rail': 'linear-gradient(180deg, #2a1e15 0%, #1c1410 55%, #120d08 100%)',
        'gold-choice': 'linear-gradient(180deg, #f8dc96 0%, #f0c75e 45%, #e0a93f 100%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
      },
      animation: {
        'fade-up': 'fade-up 240ms ease-out both',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
