import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        brand: {
          50: "#edfaf4",
          100: "#d3f3e4",
          200: "#aae6cc",
          300: "#72d3ae",
          400: "#3ab88d",
          500: "#1a9c75",
          600: "#107d5e",
          700: "#0d654d",
          800: "#0d503f",
          900: "#0b4234",
        },
        surface: {
          0: "#ffffff",
          1: "#f8f9f7",
          2: "#f1f3f0",
          3: "#e8ebe6",
        },
        ink: {
          primary: "#0f1a14",
          secondary: "#3d5046",
          muted: "#7a927f",
          faint: "#b8ccbc",
        }
      },
      borderRadius: {
        "xl": "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(15,26,20,0.06), 0 1px 2px rgba(15,26,20,0.04)",
        "elevated": "0 4px 16px rgba(15,26,20,0.08), 0 1px 4px rgba(15,26,20,0.06)",
        "modal": "0 20px 60px rgba(15,26,20,0.16), 0 4px 16px rgba(15,26,20,0.08)",
      }
    },
  },
  plugins: [],
};
export default config;
