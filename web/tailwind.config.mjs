/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f4f5",
          100: "#e4e4e7",
          400: "#a1a1aa",
          500: "#71717a",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#0a0a0b",
        },
        accent: {
          400: "#7dd3fc",
          500: "#38bdf8",
          600: "#0ea5e9",
        },
        terminal: {
          green: "#4ade80",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'Inter'", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(56,189,248,0.25)",
      },
    },
  },
  plugins: [],
};
