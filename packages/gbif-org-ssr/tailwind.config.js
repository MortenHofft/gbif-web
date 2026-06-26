/** @type {import('tailwindcss').Config} */
export default {
  // Scan server presentation components AND client islands for class names.
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // TODO: lift the real theme from packages/gbif-org/tailwind.config.js
      // (colors, fonts, radii) once the slice is approved.
    },
  },
  plugins: [],
};
