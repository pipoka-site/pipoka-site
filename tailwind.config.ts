import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        wine: {
          50: "#fff7f7",
          100: "#fde8e9",
          500: "#9b0d1f",
          700: "#760714",
          900: "#4e050d"
        },
        gold: {
          400: "#e2bd4d",
          500: "#d4a72c",
          600: "#b88716"
        },
        cream: "#fff7ec",
        rose: {
          50: "#fdf1f0",
          100: "#f8e3e1",
          200: "#f1cdca"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(78,5,13,.12)"
      }
    },
  },
  plugins: [],
} satisfies Config;
