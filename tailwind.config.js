/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Notion Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        // ── Notion light shell tokens (DESIGN.md) ──
        primary: { DEFAULT: '#5645d4', pressed: '#4534b3', deep: '#3a2a99' },
        navy: { DEFAULT: '#0a1530', deep: '#070f24', mid: '#1a2a52' },
        link: { DEFAULT: '#0075de', pressed: '#005bab' },
        canvas: '#ffffff',
        surface: { DEFAULT: '#f6f5f4', soft: '#fafaf9' },
        hairline: { DEFAULT: '#e5e3df', soft: '#ede9e4', strong: '#c8c4be' },
        ink: { DEFAULT: '#1a1a1a', deep: '#000000' },
        charcoal: '#37352f',
        slate: '#5d5b54',
        steel: '#787671',
        stone: '#a4a097',
        muted: '#bbb8b1',
        // pastel card tints
        tint: {
          peach: '#ffe8d4', rose: '#fde0ec', mint: '#d9f3e1', lavender: '#e6e0f5',
          sky: '#dcecfa', yellow: '#fef7d6', cream: '#f8f5e8', gray: '#f0eeec'
        },
        // semantic
        success: '#1aae39',
        warning: '#dd5b00',
        danger: '#e03131',
        // ── Dark industrial cyber tokens (metric dashboards) ──
        cyber: {
          bg: '#0b0f17',        // deepest panel bg
          panel: '#11161f',     // card bg
          'panel-2': '#161c27', // raised card bg
          line: '#232b39',      // grid / hairline on dark
          'line-soft': '#1b222e',
          text: '#e6edf6',      // primary on dark
          'text-2': '#9aa7ba',  // secondary on dark
          'text-3': '#5e6b7e',  // tertiary on dark
          cyan: '#38e1ff',      // primary accent / live
          'cyan-deep': '#0891b2',
          violet: '#8b7bff',
          lime: '#9cff57',
          amber: '#ffb648',
          red: '#ff5f6d',
          green: '#37e0a0'
        }
      },
      borderRadius: {
        xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', '3xl': '24px'
      },
      boxShadow: {
        'nz-1': 'rgba(15, 15, 15, 0.04) 0px 1px 2px 0px',
        'nz-2': 'rgba(15, 15, 15, 0.08) 0px 4px 12px 0px',
        'nz-3': 'rgba(15, 15, 15, 0.20) 0px 24px 48px -8px',
        'nz-4': 'rgba(15, 15, 15, 0.16) 0px 16px 48px -8px',
        'cyber-glow': '0 0 0 1px rgba(56,225,255,0.12), 0 0 24px -6px rgba(56,225,255,0.35)',
        'cyber-inset': 'inset 0 1px 0 0 rgba(255,255,255,0.03)'
      },
      keyframes: {
        pulseLive: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' }
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } }
      },
      animation: {
        'pulse-live': 'pulseLive 1.6s ease-in-out infinite',
        sweep: 'sweep 2.4s linear infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
}
