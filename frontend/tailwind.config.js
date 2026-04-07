/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "tertiary-fixed-dim": "#c2def0",
                "error": "#ee7d77",
                "on-primary-fixed": "#3e4040",
                "error-container": "#7f2927",
                "surface": "#0e0e0e",
                "surface-dim": "#0e0e0e",
                "secondary-fixed": "#e3e2e2",
                "surface-tint": "#c6c6c7",
                "on-tertiary-container": "#3e5868",
                "on-secondary-fixed": "#3f3f3f",
                "primary-container": "#454747",
                "on-error-container": "#ff9993",
                "on-tertiary-fixed-variant": "#486272",
                "on-background": "#e5e5e5",
                "outline-variant": "#484848",
                "tertiary": "#eff8ff",
                "primary-dim": "#b8b9b9",
                "on-tertiary-fixed": "#2c4655",
                "on-tertiary": "#466170",
                "inverse-on-surface": "#555555",
                "error-dim": "#bb5551",
                "tertiary-dim": "#c2def0",
                "on-primary-fixed-variant": "#5a5c5c",
                "surface-container": "#191919",
                "surface-container-lowest": "#000000",
                "inverse-primary": "#5e5f5f",
                "primary": "#c6c6c7",
                "surface-variant": "#262626",
                "on-primary-container": "#d0d0d0",
                "primary-fixed": "#e2e2e2",
                "primary-fixed-dim": "#d4d4d4",
                "secondary-dim": "#9e9e9e",
                "secondary-container": "#3b3b3c",
                "on-secondary-container": "#c0bfbf",
                "on-secondary-fixed-variant": "#5b5b5c",
                "secondary-fixed-dim": "#d5d4d4",
                "on-error": "#490106",
                "tertiary-container": "#d0ecff",
                "secondary": "#9e9e9e",
                "surface-bright": "#2c2c2c",
                "tertiary-fixed": "#d0ecff",
                "on-primary": "#3f4041",
                "on-surface-variant": "#ababab",
                "on-surface": "#e5e5e5",
                "inverse-surface": "#f9f9f9",
                "background": "#000000",  // forced pitch black
                "surface-container-highest": "#262626",
                "surface-container-low": "#131313",
                "outline": "#757575",
                "on-secondary": "#1f2020",
                "surface-container-high": "#1f1f1f"
            },
            borderRadius: {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem"
            },
            fontFamily: {
                "headline": ["Inter", "sans-serif"],
                "body": ["Inter", "sans-serif"],
                "label": ["Inter", "sans-serif"]
            }
        }
    },
    plugins: [],
}
