/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Stripe Design System — exact palette from stripe-DESIGN.md
                stripe: {
                    purple: '#533afd',
                    purpleHover: '#4830e0',
                    navy: '#061b31',
                    text: '#50617a',
                    muted: '#64748d',
                    bg: '#ffffff',
                    cloud: '#f8fafd',
                    neutral: '#e5edf5',
                    orange: '#ff6118',
                    cyan: '#80e9ff',
                    green: '#0CBF4C',
                    red: '#df1b41',
                    actionSubdued: '#e2e4ff',
                },
                // Semantic aliases (backward-compatible)
                primary: '#533afd',
                'primary-hover': '#4830e0',
                danger: '#df1b41',
                success: '#0CBF4C',
                warning: '#ff6118',
                card: '#ffffff',
                border: '#e5edf5',
                textMain: '#061b31',
                muted: '#64748d',
            },
            borderRadius: {
                "DEFAULT": "4px",
                "md": "6px",
                "lg": "8px",
                "xl": "12px",
                "2xl": "16px",
                "full": "9999px"
            },
            fontFamily: {
                "headline": ["'sohne-var'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
                "body": ["'sohne-var'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
                "label": ["'sohne-var'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"]
            },
            boxShadow: {
              'stripe': '0 2px 5px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
              'stripe-hover': '0 6px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
              'stripe-focus': '0 0 0 3px rgba(83, 58, 253, 0.2)',
            }
        }
    },
    plugins: [],
}
