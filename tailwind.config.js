/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#F6F7F2",
        ink: "#17201C",
        rust: "#B5462D",
        clay: "#D69A72",
        sage: "#668A78",
        muted: "#68736D",
        forest: "#1D5A4A",
        pearl: "#FBFCF9",
      },
      fontFamily: {
        serif: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};
