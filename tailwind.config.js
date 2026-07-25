/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#FAF3E3",
        pearl: "#F4EADA",
        gold: {
          light: "#FAF3E3",
          DEFAULT: "#D4AF37",
          medium: "#C5A059",
          dark: "#9A7B31",
        },
        teal: {
          light: "#E0F2F1",
          DEFAULT: "#0D5C63",
          medium: "#136F77",
          dark: "#083B40",
        },
        ink: "#17201C",
        rust: "#B5462D",
        clay: "#D69A72",
        sage: "#14746F",
        muted: "#68736D",
        forest: "#0D5C63",
      },
      fontFamily: {
        serif: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};
