/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Council-redesign semantic aliases → mapped to team-approved Material Design 3 palette
        // (palette sourced from mockup.html; light theme, signed off by team)
        console: "#f8f9ff",            // page background (surface)
        card: "#eff4ff",               // card surface (surface-container-low)
        "card-foreground": "#0b1c30",  // text on card (on-surface)
        border: "#bccac0",             // outline-variant
        muted: "#e5eeff",              // surface-container
        "muted-foreground": "#3d4a42", // on-surface-variant
        accent: "#e5eeff",
        ok: "#006948",                 // primary green = good signal
        "ok-foreground": "#ffffff",    // on-primary
        warn: "#b45309",               // amber-700 — not in MD3 set, close to warning
        "warn-foreground": "#ffffff",
        alert: "#ba1a1a",              // error — critical alert
        "alert-foreground": "#ffffff", // on-error
        highlight: "#006948",          // primary green — connection window accent
        "highlight-foreground": "#ffffff",
        primary: "#006948",
        "primary-container": "#00855d",
        "on-primary": "#ffffff",
        "on-primary-container": "#f5fff7",
        "primary-fixed": "#85f8c4",
        "primary-fixed-dim": "#68dba9",
        "on-primary-fixed": "#002114",
        "on-primary-fixed-variant": "#005137",
        secondary: "#565e74",
        "secondary-container": "#dae2fd",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#5c647a",
        "secondary-fixed": "#dae2fd",
        "secondary-fixed-dim": "#bec6e0",
        "on-secondary-fixed": "#131b2e",
        "on-secondary-fixed-variant": "#3f465c",
        tertiary: "#4f5d72",
        "tertiary-container": "#67758c",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#fdfcff",
        "tertiary-fixed": "#d5e3fd",
        "tertiary-fixed-dim": "#b9c7e0",
        "on-tertiary-fixed": "#0d1c2f",
        "on-tertiary-fixed-variant": "#3a485c",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        background: "#f8f9ff",
        surface: "#f8f9ff",
        "surface-dim": "#cbdbf5",
        "surface-bright": "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "surface-variant": "#d3e4fe",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#3d4a42",
        outline: "#6d7a72",
        "outline-variant": "#bccac0",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",
        "inverse-primary": "#68dba9",
        "surface-tint": "#006c4a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "headline-xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "14px", fontWeight: "500" }],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl": "0.75rem",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        gutter: "24px",
        "margin-mobile": "16px",
        "margin-desktop": "48px",
      },
    },
  },
  plugins: [],
};
