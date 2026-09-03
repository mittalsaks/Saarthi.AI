/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary blue
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#60a5fa',
          lighter: '#93c5fd',
          mid: '#3b82f6',
        },
        // Teal/cyan accent
        accent: {
          DEFAULT: '#0891b2',
          cyan: '#06b6d4',
          green: '#0f9d6e',
          light: '#67e8f9',
        },
        // Light tint backgrounds
        surface: {
          50: '#f7fbff',
          100: '#eef6ff',
          200: '#eaf2ff',
          300: '#e6f0ff',
          400: '#e7eefb',
          500: '#dbe6f7',
          600: '#dbe9fd',
          700: '#cfe4ff',
        },
        muted: {
          DEFAULT: '#5c6c86',
          light: '#8a97ac',
        },
        danger: {
          DEFAULT: '#dc2626',
          light: '#f87171',
        },
        warning: {
          DEFAULT: '#d97706',
          light: '#fbbf24',
        },
        navy: '#1e3a8a',
        purple: '#c4b5fd',
      },
      backgroundImage: {
        'cta-gradient': 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
        'cta-gradient-deep': 'linear-gradient(120deg, #0f2f66, #1d4ed8 55%, #0891b2)',
        'brand-mark': 'linear-gradient(145deg, #3b82f6, #1d4ed8 65%, #1e3a8a)',
        'nav-active': 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        'step-num': 'linear-gradient(150deg, #60a5fa, #2563eb)',
      },
      fontFamily: {
        sans: ['Sora', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,30,61,0.06)',
        card: '0 6px 20px -4px rgba(37,99,235,0.16), 0 2px 6px rgba(15,30,61,0.05)',
        lifted: '0 20px 45px -12px rgba(37,99,235,0.28), 0 6px 16px -4px rgba(15,30,61,0.08)',
        'nav-active': '0 10px 20px -8px rgba(37,99,235,0.55)',
      },
      borderRadius: {
        xl2: '18px',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--floaty-rot, 0deg))' },
          '50%': { transform: 'translateY(-14px) rotate(var(--floaty-rot, 0deg))' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(-20px, 22px) scale(1.05)' },
          '66%': { transform: 'translate(16px, -18px) scale(0.97)' },
        },
        spin3d: {
          '0%': { transform: 'perspective(600px) rotateY(0deg) rotateX(8deg)' },
          '100%': { transform: 'perspective(600px) rotateY(360deg) rotateX(8deg)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.85) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.35)' },
          '50%': { boxShadow: '0 0 0 14px rgba(37,99,235,0)' },
        },
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
        drift: 'drift 24s ease-in-out infinite',
        spin3d: 'spin3d 14s linear infinite',
        'fade-up': 'fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fadeIn 0.6s ease both',
        'pop-in': 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};