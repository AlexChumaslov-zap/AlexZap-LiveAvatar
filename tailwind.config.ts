import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zap: {
          red: "#dc2626",
          "red-dark": "#7f1d1d",
        },
      },
      keyframes: {
        "pulse-ring": {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(220, 38, 38, 0.7)",
          },
          "50%": {
            transform: "scale(1.05)",
            boxShadow: "0 0 0 20px rgba(220, 38, 38, 0)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(220, 38, 38, 0)",
          },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 3s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
