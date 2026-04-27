/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        wealth: {
          emerald: '#50C878',
          forest: '#004B3B',
          depth: '#0B3D2E',
        },
        midnight: {
          void: '#020605',
        }
      },
    },
  },
  plugins: [],
}
