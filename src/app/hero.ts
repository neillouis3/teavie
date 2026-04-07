// hero.ts — primary uses green (success-style) across HeroUI
import { heroui } from "@heroui/react";

const greenPrimaryLight = {
  50: "#f0fdf4",
  100: "#dcfce7",
  200: "#bbf7d0",
  300: "#86efac",
  400: "#4ade80",
  500: "#22c55e",
  600: "#16a34a",
  700: "#15803d",
  800: "#166534",
  900: "#14532d",
  foreground: "#ffffff",
  DEFAULT: "#22c55e",
};

const greenPrimaryDark = {
  50: "#14532d",
  100: "#166534",
  200: "#15803d",
  300: "#16a34a",
  400: "#22c55e",
  500: "#4ade80",
  600: "#86efac",
  700: "#bbf7d0",
  800: "#dcfce7",
  900: "#f0fdf4",
  foreground: "#052e16",
  DEFAULT: "#4ade80",
};

export default heroui({
  themes: {
    light: {
      extend: "light",
      colors: {
        primary: greenPrimaryLight,
      },
    },
    dark: {
      extend: "dark",
      colors: {
        primary: greenPrimaryDark,
      },
    },
  },
});
