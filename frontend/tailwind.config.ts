import type { Config } from "tailwindcss";

// Silah | صلة design system -- exact palette from the product brief's UI
// direction. Do not introduce ad-hoc colors elsewhere; extend this file.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "deep-navy": "#07111F",
        "dark-navy": "#0D1B2E",
        "royal-navy": "#122A52",
        "warm-white": "#FAF8F4",
        "surface-white": "#FFFFFF",
        "soft-gray": "#F4F6FA",
        "primary-blue": "#AFC6FF",
        turquoise: "#16C8B5",
        gold: "#C7A66A",
      },
      fontFamily: {
        sans: ["var(--font-en)", "system-ui", "sans-serif"],
        arabic: ["var(--font-ar)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
