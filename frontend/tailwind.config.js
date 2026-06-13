/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // CRITICAL: extend doesn't replace. We REPLACE colors and fontFamily.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      // === Artisanal Design System Surfaces ===
      surface: '#fbf9f9',
      'surface-dim': '#dbd9da',
      'surface-bright': '#ffffff',
      // Kept legacy names for backward compat with existing className usage
      paper:  '#f5f3f4',     // maps to surface-container-low
      paper2: '#efedee',     // maps to surface-container
      ink:    '#1b1c1c',     // maps to on-surface
      ink2:   '#43474b',     // maps to on-surface-variant
      steel:  '#73787b',     // maps to outline
      steel2: '#c3c7cb',     // maps to outline-variant
      mute:   '#c3c7cb',
      rule:   '#c3c7cb',     // outline-variant
      rule2:  '#e9e8e8',
      // Primary = Black
      rust:   '#000000',     // was purple, now black (primary)
      rust2:  '#1a1a1a',     // primary hover
      rustBg: '#e4e2e3',
      // Semantic
      success: '#15803d',
      successBg: 'rgba(34,197,94,0.12)',
      warn:    '#854d0e',
      warnBg:  'rgba(234,179,8,0.10)',
      danger:  '#ba1a1a',
      dangerBg:'rgba(186,26,26,0.10)',
      info:    '#1d4ed8',
      infoBg:  'rgba(59,130,246,0.10)',
      // Secondary steel-blue
      secondary: '#4e616e',
      'secondary-container': '#d1e5f5',
    },
    fontFamily: {
      sans:  ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      serif: ['"EB Garamond"', 'Georgia', 'serif'],
      mono:  ['ui-monospace', 'monospace']
    },
    fontSize: {
      '2xs': ['11px', '16px'],
      'xs':  ['12px', '18px'],
      'sm':  ['13px', '20px'],
      'base':['14px', '21px'],
      'md':  ['15px', '24px'],
      'lg':  ['16px', '24px'],
      'xl':  ['18px', '28px'],
      '2xl': ['24px', '32px'],
      '3xl': ['28px', '36px'],
      '4xl': ['36px', '44px']
    },
    borderRadius: {
      'none':    '0',
      'sm':      '4px',
      'DEFAULT': '8px',
      'md':      '12px',
      'lg':      '16px',
      'xl':      '20px',
      '2xl':     '24px',
      '3xl':     '32px',
      'full':    '9999px'
    },
    extend: {
      borderWidth: { '0.5': '0.5px' },
      spacing: { '4.5': '18px', '7.5': '30px', '15': '60px' },
      boxShadow: {
        'xs':  '0 1px 2px rgba(0,0,0,0.05)',
        'sm':  '0 2px 4px rgba(0,0,0,0.06)',
        'md':  '0 4px 16px rgba(0,0,0,0.08)',
        'lg':  '0 8px 32px rgba(0,0,0,0.10)',
        'xl':  '0 16px 48px rgba(0,0,0,0.12)',
      }
    }
  },
  plugins: []
};
