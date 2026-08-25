import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07060a",
          900: "#0d0b12",
          800: "#16131c",
          700: "#221e2a",
        },
        ember: {
          300: "#f3d19a",
          400: "#e8a54b",
          500: "#d4892a",
        },
        signal: "#ff4d3a",
        mint: "#7ee0c6",
        paper: "#f4efe6",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        ember: "0 0 40px rgba(232, 165, 75, 0.18)",
        call: "0 0 80px rgba(255, 77, 58, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
