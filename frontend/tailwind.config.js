/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // CRITICAL: extend doesn't replace. We REPLACE colors and fontFamily.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      paper: '#F8F9FA',      // Odoo light gray bg
      paper2: '#E9ECEF',     // Odoo secondary bg
      ink: '#212529',        // Odoo text color
      ink2: '#495057',       // Odoo secondary text
      steel: '#6C757D',      // Odoo muted text
      steel2: '#ADB5BD',     
      mute: '#CED4DA',
      rule: '#DEE2E6',       // Odoo border color
      rule2: '#E5E7EB',
      rust: '#714B67',       // PRIMARY: Odoo Purple
      rust2: '#5C3D54',      // PRIMARY HOVER
      rustBg: '#F3E8EF',
      success: '#198754',    // Odoo success
      successBg: '#D1E7DD',
      warn: '#FFC107',       // Odoo warning
      warnBg: '#FFF3CD',
      danger: '#DC3545',     // Odoo danger
      dangerBg: '#F8D7DA',
      info: '#017E84',       // SECONDARY: Odoo Teal
      infoBg: '#D1F0F1'
    },
    fontFamily: {
      sans: ['"Roboto"', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'monospace']
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
      'none': '0',
      'sm':   '2px',
      'DEFAULT': '4px',
      'md':   '6px',
      'lg':   '8px',
      'full': '9999px'
    },
    extend: {
      borderWidth: { '0.5': '0.5px' },
      spacing: { '4.5': '18px', '7.5': '30px', '15': '60px' }
    }
  },
  plugins: []
};
