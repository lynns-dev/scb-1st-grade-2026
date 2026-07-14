/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f6ff",
          100: "#e3eaff",
          200: "#c2d0ff",
          300: "#9bb0ff",
          400: "#6f88ff",
          500: "#4a63f2",
          600: "#3849cc",
          700: "#2c39a3",
          800: "#232d7f",
          900: "#1c2566",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 24, 60, 0.06), 0 1px 12px rgba(20, 24, 60, 0.05)",
      },
    },
  },
  plugins: [],
};
