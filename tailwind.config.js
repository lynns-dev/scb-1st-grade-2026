/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "The Village" brand — dusty blueberry (primary) + warm honey (accent).
        brand: {
          50: "oklch(0.97 0.015 250)",
          100: "oklch(0.93 0.03 250)",
          200: "oklch(0.86 0.05 250)",
          300: "oklch(0.77 0.07 250)",
          400: "oklch(0.67 0.085 250)",
          500: "oklch(0.58 0.09 250)",
          600: "oklch(0.50 0.095 250)",
          700: "oklch(0.42 0.09 250)",
          800: "oklch(0.34 0.08 250)",
          900: "oklch(0.27 0.07 250)",
        },
        accent: {
          50: "oklch(0.97 0.02 80)",
          100: "oklch(0.94 0.04 80)",
          200: "oklch(0.89 0.07 80)",
          300: "oklch(0.84 0.09 80)",
          400: "oklch(0.81 0.105 80)",
          500: "oklch(0.78 0.12 80)",
          600: "oklch(0.68 0.13 80)",
          700: "oklch(0.58 0.12 80)",
          800: "oklch(0.48 0.10 80)",
          900: "oklch(0.38 0.08 80)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 24, 60, 0.06), 0 1px 12px rgba(20, 24, 60, 0.05)",
      },
    },
  },
  plugins: [],
};
