import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        gtd: {
          surface: {
            DEFAULT: "#0f172a",
            light: "#1e293b",
            lighter: "#334155",
          },
          accent: {
            DEFAULT: "#f59e0b",
            light: "#fbbf24",
            dark: "#d97706",
          },
          success: "#10b981",
          danger: "#f43f5e",
          info: "#38bdf8",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-up": "slide-up 0.4s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 158, 11, 0.4)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(245, 158, 11, 0.2)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
