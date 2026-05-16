/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cursor brand
        primary: "#f54e00",
        "primary-active": "#d04200",
        "on-primary": "#ffffff",

        // Cursor surface
        canvas: "#f7f7f4",
        "canvas-soft": "#fafaf7",
        "surface-card": "#ffffff",
        "surface-strong": "#e6e5e0",

        // Cursor ink/text
        ink: "#26251e",
        "ink-muted": "#807d72",
        "ink-muted-soft": "#a09c92",
        "body": "#5a5852",
        "body-strong": "#26251e",

        // Cursor hairlines
        hairline: "#e6e5e0",
        "hairline-soft": "#efeee8",
        "hairline-strong": "#cfcdc4",

        // Cursor timeline (AI-action signature)
        "timeline-thinking": "#dfa88f",
        "timeline-grep": "#9fc9a2",
        "timeline-read": "#9fbbe0",
        "timeline-edit": "#c0a8dd",
        "timeline-done": "#c08532",

        // Cursor semantic
        "semantic-success": "#1f8a65",
        "semantic-error": "#cf2d56",

        // Tailwind defaults mapped to Cursor
        background: "#f7f7f4",
        foreground: "#26251e",
        card: "#ffffff",
        "card-foreground": "#26251e",
        popover: "#ffffff",
        "popover-foreground": "#26251e",
        muted: "#e6e5e0",
        "muted-foreground": "#807d72",
        accent: "#fafaf7",
        "accent-foreground": "#26251e",
        border: "#e6e5e0",
        input: "#ffffff",
        ring: "#f54e00",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px",
        full: "9999px",
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        base: "16px",
        md: "20px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "80px",
      },
      fontSize: {
        "display-mega": ["72px", { lineHeight: "1.1", letterSpacing: "-2.16px", fontWeight: "400" }],
        "display-lg": ["36px", { lineHeight: "1.2", letterSpacing: "-0.72px", fontWeight: "400" }],
        "display-md": ["26px", { lineHeight: "1.25", letterSpacing: "-0.325px", fontWeight: "400" }],
        "display-sm": ["22px", { lineHeight: "1.3", letterSpacing: "-0.11px", fontWeight: "400" }],
        "title-md": ["18px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "title-sm": ["16px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "400" }],
        "caption-uppercase": ["11px", { lineHeight: "1.4", letterSpacing: "0.88px", fontWeight: "600", textTransform: "uppercase" }],
        code: ["13px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        button: ["14px", { lineHeight: "1.0", letterSpacing: "0", fontWeight: "500" }],
        "nav-link": ["14px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
}
