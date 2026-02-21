/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5B32D6", // Mastermind purple
          soft: "#ECE9FF",
          dark: "#3B22A6",
        },
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
