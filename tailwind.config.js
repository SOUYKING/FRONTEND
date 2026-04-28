/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          DEFAULT: '#2EF2FF',
          glow: 'rgba(46, 242, 255, 0.3)',
          'glow-strong': 'rgba(46, 242, 255, 0.5)',
        },
        gold: {
          DEFAULT: '#2EF2FF',
          light: '#6AF7FF',
          dark: '#1DAEFF',
          glow: 'rgba(46, 242, 255, 0.3)',
        },
        'electric-blue': '#1DAEFF',
        'deep-blue': '#080e24',
        navy: '#0a1628',
        purple: {
          DEFAULT: '#A855F7',
          glow: 'rgba(168, 85, 247, 0.3)',
        },
        magenta: {
          DEFAULT: '#FF4FD8',
          glow: 'rgba(255, 79, 216, 0.2)',
        },
        violet: '#7A5CFF',
        green: {
          DEFAULT: '#22C55E',
          glow: 'rgba(34, 197, 94, 0.3)',
          bg: 'rgba(34, 197, 94, 0.12)',
        },
        orange: {
          DEFAULT: '#F97316',
          glow: 'rgba(249, 115, 22, 0.3)',
        },
        red: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.3)',
          bg: 'rgba(239, 68, 68, 0.12)',
        },
        discord: {
          DEFAULT: '#5865F2',
          hover: '#4752C4',
        },
        bg: {
          base: '#05081c',
          surface: 'rgba(10, 22, 50, 0.6)',
          card: 'rgba(15, 25, 55, 0.7)',
          'card-hover': 'rgba(20, 35, 70, 0.8)',
          elevated: 'rgba(20, 30, 65, 0.8)',
          glass: 'rgba(10, 20, 45, 0.55)',
          'glass-strong': 'rgba(10, 20, 45, 0.75)',
          hover: 'rgba(46, 242, 255, 0.05)',
        },
        text: {
          DEFAULT: '#FFFFFF',
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.75)',
          muted: 'rgba(255, 255, 255, 0.45)',
          dim: 'rgba(255, 255, 255, 0.25)',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.06)',
          hover: 'rgba(255, 255, 255, 0.12)',
          glow: 'rgba(46, 242, 255, 0.15)',
          'glow-strong': 'rgba(46, 242, 255, 0.3)',
          purple: 'rgba(168, 85, 247, 0.2)',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'lg': '0 8px 40px rgba(0, 0, 0, 0.5)',
        'xl': '0 20px 60px rgba(0, 0, 0, 0.6)',
        'cyan': '0 0 20px rgba(46, 242, 255, 0.1)',
        'purple': '0 0 20px rgba(168, 85, 247, 0.1)',
        'cyan-lg': '0 0 40px rgba(46, 242, 255, 0.25)',
        'discord': '0 4px 24px rgba(88, 101, 242, 0.35)',
      },
      backdropBlur: {
        xs: '4px',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '250ms',
        'slow': '400ms',
        'extra': '600ms',
      },
      transitionTimingFunction: {
        'bounce': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease',
        'fade-in-up': 'fadeInUp 0.5s ease',
        'fade-in-down': 'fadeInDown 0.5s ease',
        'fade-in-scale': 'fadeInScale 0.3s ease',
        'slide-in-left': 'slideInLeft 0.3s ease',
        'slide-in-right': 'slideInRight 0.3s ease',
        'glow-pulse': 'glowPulse 2s infinite',
        'glow-pulse-purple': 'glowPulsePurple 2s infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse': 'pulse 2s infinite',
        'slide-up': 'slideUp 0.3s ease',
        'scale-in': 'scaleIn 0.3s ease',
        'spin': 'spin 0.8s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(46, 242, 255, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(46, 242, 255, 0.25)' },
        },
        glowPulsePurple: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.25)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
