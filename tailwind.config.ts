import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#f1f7f2",
          100: "#dcebdf",
          200: "#bad8c2",
          300: "#8dbd9c",
          400: "#5e9d73",
          500: "#3f8158",
          600: "#2e6645",
          700: "#265238",
          800: "#20422f",
          900: "#1b3728",
          950: "#0d1f16"
        },
        sage: {
          50: "#f6f8f4",
          100: "#e9efe4",
          200: "#d4dfca",
          300: "#b5c8a5",
          400: "#93ad7d",
          500: "#76925f",
          600: "#5c744a",
          700: "#495b3c",
          800: "#3c4a33",
          900: "#34402d"
        },
        warmwhite: "#fbfaf7",
        ink: "#1f2a24",
        amber: {
          50: "#fff8eb",
          100: "#ffedc6",
          200: "#ffd888",
          300: "#ffbe4a",
          400: "#ffa41f",
          500: "#f98307",
          600: "#dd5f02",
          700: "#b74206",
          800: "#94330c",
          900: "#7a2b0d"
        }
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ]
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(31,42,36,.04), 0 8px 24px -12px rgba(31,42,36,.18)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in .18s ease-out"
      }
    }
  },
  plugins: []
};

export default config;
